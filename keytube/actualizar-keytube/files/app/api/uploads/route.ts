import { z } from "zod";
import {
  requireCreator,
  sameOrigin,
  db,
  response,
  failure,
  AppError,
} from "@/lib/keytube-server";
import { bucket, MAX_UPLOAD, validFile } from "@/lib/media";
import { timedPreviewIsShort } from "@/lib/preview-validation";
import {STUDIO_CAPACITY} from '@/lib/upload-limits';
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const user = await requireCreator();
    const role = z
      .enum(["thumbnail", "preview", "full", "avatar"])
      .parse(new URL(req.url).searchParams.get("role"));
    const limit = role === "avatar" ? 2 * 1024 * 1024 : MAX_UPLOAD;
    const sizeMessage = role === "avatar" ? "La foto de perfil debe pesar como máximo 2 MB." : "El límite por archivo es 20 MB.";
    const mime = (req.headers.get("content-type") || "")
      .split(";")[0]
      .toLowerCase();
    const name =
      decodeURIComponent(req.headers.get("x-file-name") || "archivo")
        .replace(/[\r\n\x00-\x1f]/g, "")
        .slice(0, 150) || "archivo";
    if (Number(req.headers.get("content-length") || 0) > limit)
      throw new AppError(413, sizeMessage);
    const total = await db()
      .prepare(
        "SELECT COALESCE((SELECT SUM(size) FROM assets WHERE owner_id = ?),0)+COALESCE((SELECT SUM(size) FROM upload_sessions WHERE owner_id = ?),0) AS size",
      )
      .bind(user.userId,user.userId)
      .first<{ size: number }>();
    if ((total?.size || 0) >= STUDIO_CAPACITY)
      throw new AppError(
        413,
        "Alcanzaste el límite de 5 GB de este estudio.",
      );
    const reader = req.body?.getReader();
    if (!reader) throw new AppError(400, "Selecciona un archivo.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new AppError(413, sizeMessage);
      }
      chunks.push(value);
    }
    if ((total?.size || 0) + size > STUDIO_CAPACITY)
      throw new AppError(
        413,
        "Este archivo supera el espacio disponible de tu estudio.",
      );
    const buffer = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.length;
    }
    if (!size || !validFile(buffer, mime))
      throw new AppError(
        400,
        "Formato no admitido o contenido del archivo inválido.",
      );
    if ((role === "thumbnail" || role === "avatar") && !["image/jpeg","image/png","image/webp"].includes(mime))
      throw new AppError(400, "La portada debe ser JPG, PNG o WEBP.");
    if (role === "preview" && /^(video|audio)\//.test(mime) && !timedPreviewIsShort(buffer, mime))
      throw new AppError(400, "El adelanto debe ser un WebM o WAV de hasta 10 segundos. Usa la generación automática del estudio.");
    const id = crypto.randomUUID(),
      storageKey = `${role}/${id}`;
    await bucket().put(storageKey, buffer, {
      httpMetadata: { contentType: mime },
    });
    try {
      const saved = await db()
        .prepare(
          "INSERT INTO assets (id,owner_id,storage_key,role,name,mime,size,created_at) SELECT ?,?,?,?,?,?,?,? WHERE COALESCE((SELECT SUM(size) FROM assets WHERE owner_id=?),0)+COALESCE((SELECT SUM(size) FROM upload_sessions WHERE owner_id=?),0)+? <= ? RETURNING id",
        )
        .bind(id, user.userId, storageKey, role, name, mime, size, Date.now(),user.userId,user.userId,size,STUDIO_CAPACITY)
        .first();
      if(!saved)throw new AppError(413,'Este archivo supera el espacio disponible de tu estudio.');
    } catch (e) {
      await bucket().delete(storageKey);
      throw e;
    }
    return response({ asset: { id, role, name, mime, size } }, 201);
  } catch (e) {
    return failure(e);
  }
}
