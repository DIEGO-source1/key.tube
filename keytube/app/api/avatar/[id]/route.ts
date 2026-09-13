import { db, AppError, failure } from "@/lib/keytube-server";
import { getAsset, bucket } from "@/lib/media";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const asset = await getAsset(id);
    if (asset.role !== "avatar" || !asset.mime.startsWith("image/"))
      throw new AppError(404, "Foto de perfil no encontrada.");

    const used = await db()
      .prepare("SELECT owner_id FROM profiles WHERE avatar=? LIMIT 1")
      .bind(`asset:${id}`)
      .first();
    if (!used) throw new AppError(404, "Foto de perfil no encontrada.");

    const object = await bucket().get(asset.storage_key);
    if (!object) throw new AppError(404, "Foto de perfil no disponible.");

    const body = new ArrayBuffer(object.body.byteLength);
    new Uint8Array(body).set(object.body);
    return new Response(body, {
      headers: {
        "Content-Type": asset.mime,
        "Content-Length": String(asset.size),
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
