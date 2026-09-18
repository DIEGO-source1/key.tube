import { db, AppError, failure } from "@/lib/keytube-server";
import { getAsset, bucket } from "@/lib/media";
import { ensureV10Schema } from "@/lib/v10";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureV10Schema();
    const { id } = await params;
    const asset = await getAsset(id);
    if (!(["avatar", "cover"].includes(asset.role)) || !asset.mime.startsWith("image/"))
      throw new AppError(404, "Imagen de perfil no encontrada.");

    const value = `asset:${id}`;
    const used = await db()
      .prepare("SELECT owner_id FROM profiles WHERE avatar=? OR cover=? LIMIT 1")
      .bind(value, value)
      .first();
    if (!used) throw new AppError(404, "Imagen de perfil no encontrada.");

    const object = await bucket().get(asset.storage_key);
    if (!object) throw new AppError(404, "Imagen de perfil no disponible.");
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
