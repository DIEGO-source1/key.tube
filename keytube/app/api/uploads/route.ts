import { z } from "zod";
import {
  requireCreator,
  sameOrigin,
  db,
  response,
  failure,
  AppError,
} from "@/lib/keytube-server";
import { bucket, MAX_UPLOAD, CREATOR_STORAGE_QUOTA, validFile } from "@/lib/media";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const user = await requireCreator();
    const role = z
      .enum(["thumbnail", "preview", "full", "avatar"])
      .parse(new URL(req.url).searchParams.get("role"));
    const mime = (req.headers.get("content-type") || "")
      .split(";")[0]
      .toLowerCase();
    const name =
      decodeURIComponent(req.headers.get("x-file-name") || "archivo")
        .replace(/[\r\n\x00-\x1f]/g, "")
        .slice(0, 150) || "archivo";
    if (role === "full")
      throw new AppError(400, "Los archivos completos se suben con la carga directa de hasta 500 MB.");
    const uploadLimit = role === "avatar" ? 5 * 1024 * 1024 : MAX_UPLOAD;
    if (Number(req.headers.get("content-length") || 0) > uploadLimit)
      throw new AppError(
        413,
        role === "avatar"
          ? "La foto de perfil debe pesar como máximo 5 MB."
          : "El límite por archivo es 20 MB.",
      );
    const total = await db()
      .prepare(
        "SELECT COALESCE(SUM(size),0) AS size FROM assets WHERE owner_id = ?",
      )
      .bind(user.userId)
      .first<{ size: number }>();
    if ((total?.size || 0) > CREATOR_STORAGE_QUOTA)
      throw new AppError(413, "Alcanzaste el límite de 5 GB de este estudio.");
    const reader = req.body?.getReader();
    if (!reader) throw new AppError(400, "Selecciona un archivo.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > uploadLimit) {
        await reader.cancel();
        throw new AppError(
          413,
          role === "avatar"
            ? "La foto de perfil debe pesar como máximo 5 MB."
            : "El límite por archivo es 20 MB.",
        );
      }
      chunks.push(value);
    }
    if ((total?.size || 0) + size > CREATOR_STORAGE_QUOTA)
      throw new AppError(413, "Este archivo supera el espacio disponible de tu estudio (5 GB).");
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
    if ((role === "thumbnail" || role === "avatar") && !mime.startsWith("image/"))
      throw new AppError(
        400,
        role === "avatar"
          ? "La foto de perfil debe ser JPG, PNG o WEBP."
          : "La portada debe ser JPG, PNG o WEBP.",
      );
    if (role === "preview" && !["video/webm", "audio/webm", "audio/wav", "audio/x-wav"].includes(mime))
      throw new AppError(400, "El adelanto automático debe ser WebM o WAV.");
    const id = crypto.randomUUID(),
      storageKey = `${role}/${id}`;
    await bucket().put(storageKey, buffer, {
      httpMetadata: { contentType: mime },
    });
    try {
      await db()
        .prepare(
          "INSERT INTO assets (id,owner_id,storage_key,role,name,mime,size,created_at) VALUES (?,?,?,?,?,?,?,?)",
        )
        .bind(id, user.userId, storageKey, role, name, mime, size, Date.now())
        .run();
    } catch (e) {
      await bucket().delete(storageKey);
      throw e;
    }
    return response({ asset: { id, role, name, mime, size } }, 201);
  } catch (e) {
    return failure(e);
  }
}
