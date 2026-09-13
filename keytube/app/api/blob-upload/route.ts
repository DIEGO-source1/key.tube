import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { z } from "zod";
import { requireCreator, db, AppError } from "@/lib/keytube-server";
import { CREATOR_STORAGE_QUOTA, MAX_FULL_UPLOAD } from "@/lib/media";

export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  assetId: z.string().uuid(),
  name: z.string().min(1).max(150),
  mime: z.string().min(1).max(120),
  size: z.number().int().positive().max(MAX_FULL_UPLOAD),
});

const allowed = new Set([
  "video/mp4", "video/webm",
  "audio/mpeg", "audio/wav", "audio/x-wav", "audio/ogg", "audio/webm",
  "image/jpeg", "image/png", "image/webp",
  "application/pdf", "text/plain",
]);

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const user = await requireCreator();
        const payload = payloadSchema.parse(JSON.parse(clientPayload || "{}"));
        if (!allowed.has(payload.mime)) throw new AppError(400, "Formato de archivo no admitido.");
        if (!pathname.startsWith(`keytube/full/${payload.assetId}.`))
          throw new AppError(400, "Ruta de carga inválida.");
        const total = await db()
          .prepare("SELECT COALESCE(SUM(size),0) AS size FROM assets WHERE owner_id = ?")
          .bind(user.userId)
          .first<{ size: number }>();
        if ((Number(total?.size) || 0) + payload.size > CREATOR_STORAGE_QUOTA)
          throw new AppError(413, "Tu estudio puede almacenar hasta 5 GB en total.");
        return {
          allowedContentTypes: [payload.mime],
          maximumSizeInBytes: MAX_FULL_UPLOAD,
          addRandomSuffix: false,
          tokenPayload: JSON.stringify({ ...payload, userId: user.userId }),
        };
      },
      onUploadCompleted: async () => {
        // La fila de assets se registra inmediatamente desde /finalize.
      },
    });
    return Response.json(jsonResponse);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo autorizar la carga." }, { status: 400 });
  }
}
