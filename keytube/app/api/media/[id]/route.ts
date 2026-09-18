import { getAppUser } from "@/lib/auth";
import { getAsset, bucket, isBlobStorageKey, signedBlobReadUrl } from "@/lib/media";
import {
  db,
  hash,
  AppError,
  failure,
  type StoredPost,
} from "@/lib/keytube-server";
import { rpcClient, lockAbi } from "@/lib/unlock";
import type { Address } from "viem";
import { hasPostMembership } from "@/lib/plans";
export const dynamic = "force-dynamic";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const asset = await getAsset(id),
      url = new URL(req.url);
    let privateFile = false;
    if (url.searchParams.get("owner") === "1") {
      const user = await getAppUser();
      if (!user || user.userId !== asset.owner_id)
        throw new AppError(403, "No tienes acceso a este archivo.");
      privateFile = true;
    } else if (asset.role === "full" && url.searchParams.has("public")) {
      const published = await db().prepare("SELECT id FROM posts WHERE id=? AND asset_id=? AND visibility='free'").bind(url.searchParams.get("public"),asset.id).first();
      if(!published) throw new AppError(403,"El archivo no es contenido gratuito publicado.");
    } else if (asset.role === "full") {
      privateFile = true;
      const token = url.searchParams.get("ticket");
      if (!token || !/^\w{64}$/.test(token))
        throw new AppError(
          401,
          "Verifica tu membresía para abrir este archivo.",
        );
      const grant = await db()
        .prepare(
          "SELECT * FROM media_grants WHERE token_hash = ? AND expires_at > ?",
        )
        .bind(await hash(token), Date.now())
        .first<{ post_id: string; wallet: Address }>();
      if (!grant)
        throw new AppError(
          401,
          "El enlace expiró. Verifica nuevamente tu membresía.",
        );
      const post = await db()
        .prepare("SELECT * FROM posts WHERE id = ? AND asset_id = ?")
        .bind(grant.post_id, asset.id)
        .first<StoredPost>();
      if (!post)
        throw new AppError(403, "El archivo no corresponde a este acceso.");
      const valid = await hasPostMembership(post, grant.wallet);
      if (!valid) throw new AppError(403, "Tu membresía ya no está vigente.");
    } else {
      const published = await db()
        .prepare(
          "SELECT id FROM posts WHERE thumbnail_id = ? OR preview_id = ? LIMIT 1",
        )
        .bind(id, id)
        .first();
      if (!published)
        throw new AppError(404, "Este archivo todavía no está publicado.");
    }
    if (isBlobStorageKey(asset.storage_key)) {
      const signed = await signedBlobReadUrl(asset.storage_key);
      return Response.redirect(signed, 307);
    }
    const range = req.headers.get("range");
    let options: { offset: number; length: number } | undefined;
    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (!match) throw new AppError(416, "Rango de archivo no admitido.");
      const start = Number(match[1]),
        end = match[2]
          ? Math.min(Number(match[2]), asset.size - 1)
          : asset.size - 1;
      if (start >= asset.size || end < start)
        throw new AppError(416, "Rango fuera del archivo.");
      options = { offset: start, length: end - start + 1 };
    }
    const object = await bucket().get(
      asset.storage_key,
      options ? { range: options } : undefined,
    );
    if (!object) throw new AppError(404, "El archivo no está disponible.");
    const headers = new Headers({
      "Content-Type": asset.mime,
      "Content-Length": String(options?.length || asset.size),
      "Accept-Ranges": "bytes",
      "Cache-Control": privateFile
        ? "private, no-store"
        : "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    });
    if (options)
      headers.set(
        "Content-Range",
        `bytes ${options.offset}-${options.offset + options.length - 1}/${asset.size}`,
      );
    if (asset.mime === "application/pdf" || asset.mime === "text/plain")
      headers.set(
        "Content-Disposition",
        `inline; filename*=UTF-8''${encodeURIComponent(asset.name)}`,
      );
    // Next.js/TypeScript's Fetch types require a BodyInit backed by ArrayBuffer,
    // while Neon returns Uint8Array<ArrayBufferLike>. Copy into a plain
    // ArrayBuffer so the response body is portable across Vercel runtimes.
    const responseBody = new ArrayBuffer(object.body.byteLength);
    new Uint8Array(responseBody).set(object.body);
    return new Response(responseBody, { status: options ? 206 : 200, headers });
  } catch (e) {
    return failure(e);
  }
}
