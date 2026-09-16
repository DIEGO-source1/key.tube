import { head, del } from "@vercel/blob";
import { z } from "zod";
import { requireCreator, sameOrigin, readJson, db, response, failure, AppError } from "@/lib/keytube-server";
import { CREATOR_STORAGE_QUOTA, MAX_FULL_UPLOAD } from "@/lib/media";

export const dynamic = "force-dynamic";

const schema = z.object({
  assetId: z.string().uuid(),
  pathname: z.string().min(1).max(800),
  name: z.string().min(1).max(150),
  mime: z.string().min(1).max(120),
  size: z.number().int().positive().max(MAX_FULL_UPLOAD),
});
const allowed = new Set([
  "video/mp4", "video/webm", "video/quicktime", "video/x-m4v",
  "audio/mpeg", "audio/wav", "audio/x-wav", "audio/ogg", "audio/webm", "audio/mp4", "audio/aac",
  "image/jpeg", "image/png", "image/webp",
  "application/pdf", "text/plain",
]);

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const user = await requireCreator();
    const input = schema.parse(await readJson(req));
    if (!input.pathname.startsWith(`keytube/full/${input.assetId}.`))
      throw new AppError(400, "Ruta de archivo inválida.");
    if (!allowed.has(input.mime)) throw new AppError(400, "Formato no admitido.");

    const existing = await db().prepare("SELECT * FROM assets WHERE id=? AND owner_id=?").bind(input.assetId, user.userId).first();
    if (existing) return response({ asset: existing });

    const blob = await head(input.pathname);
    if (!blob || blob.size <= 0 || blob.size > MAX_FULL_UPLOAD) {
      try { await del(input.pathname); } catch {}
      throw new AppError(413, "El archivo completo debe pesar como máximo 500 MB.");
    }
    const contentType = (blob.contentType || input.mime).split(";")[0].toLowerCase();
    if (!allowed.has(contentType)) {
      try { await del(input.pathname); } catch {}
      throw new AppError(400, "El archivo subido no tiene un formato admitido.");
    }
    const total = await db()
      .prepare("SELECT COALESCE(SUM(size),0) AS size FROM assets WHERE owner_id = ?")
      .bind(user.userId)
      .first<{ size: number }>();
    if ((Number(total?.size) || 0) + blob.size > CREATOR_STORAGE_QUOTA) {
      try { await del(input.pathname); } catch {}
      throw new AppError(413, "Tu estudio puede almacenar hasta 5 GB en total.");
    }
    await db()
      .prepare("INSERT INTO assets (id,owner_id,storage_key,role,name,mime,size,created_at) VALUES (?,?,?,?,?,?,?,?)")
      .bind(input.assetId, user.userId, `blob:${blob.pathname}`, "full", input.name, contentType, blob.size, Date.now())
      .run();
    return response({ asset: { id: input.assetId, role: "full", name: input.name, mime: contentType, size: blob.size } }, 201);
  } catch (e) {
    return failure(e);
  }
}
