import { env } from "cloudflare:workers";
import { AppError, db, hash } from "./keytube-server";
import type { StoredPost } from "./keytube-server";
export type StoredAsset = {
  id: string;
  owner_id: string;
  storage_key: string;
  role: string;
  name: string;
  mime: string;
  size: number;
  created_at: number;
};
export const MAX_UPLOAD = 20 * 1024 * 1024;
export function bucket() {
  if (!env.BUCKET)
    throw new AppError(
      503,
      "El almacenamiento de archivos no está disponible.",
    );
  return env.BUCKET;
}
export async function getAsset(id: string) {
  const a = await db()
    .prepare("SELECT * FROM assets WHERE id = ?")
    .bind(id)
    .first<StoredAsset>();
  if (!a) throw new AppError(404, "Archivo no encontrado.");
  return a;
}
export async function validateAssets(
  draft: {
    type: string;
    thumbnailId: string | null;
    previewId: string | null;
    assetId: string | null;
  },
  ownerId: string,
) {
  for (const [role, id] of [
    ["thumbnail", draft.thumbnailId],
    ["preview", draft.previewId],
    ["full", draft.assetId],
  ] as const) {
    if (!id) continue;
    const asset = await getAsset(id);
    if (asset.owner_id !== ownerId || asset.role !== role)
      throw new AppError(403, "El archivo no pertenece a esta publicación.");
    const expected =
      role === "thumbnail"
        ? "image/"
        : draft.type === "image"
          ? "image/"
          : draft.type === "video"
            ? "video/"
            : draft.type === "audio"
              ? "audio/"
              : "";
    if (expected && !asset.mime.startsWith(expected))
      throw new AppError(
        400,
        "El formato del archivo no coincide con el tipo de contenido.",
      );
    if (
      draft.type === "document" &&
      role === "full" &&
      !["application/pdf", "text/plain"].includes(asset.mime)
    )
      throw new AppError(400, "Sube un documento PDF o TXT.");
  }
}
export async function mediaGrant(post: StoredPost, wallet: string) {
  if (!post.asset_id) return {};
  const asset = await getAsset(post.asset_id),
    bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(bytes, (x) => x.toString(16).padStart(2, "0")).join(
      "",
    ),
    expiresAt = Date.now() + 4 * 60 * 60 * 1000;
  await db()
    .prepare("DELETE FROM media_grants WHERE expires_at < ?")
    .bind(Date.now())
    .run();
  await db()
    .prepare(
      "INSERT INTO media_grants (token_hash,post_id,wallet,expires_at) VALUES (?,?,?,?)",
    )
    .bind(await hash(token), post.id, wallet, expiresAt)
    .run();
  return {
    mediaUrl: `/api/media/${asset.id}?ticket=${token}`,
    mime: asset.mime,
    expiresAt,
  };
}
export function validFile(bytes: Uint8Array, mime: string) {
  const head = new TextDecoder().decode(bytes.slice(0, 16));
  if (mime === "image/jpeg")
    return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (mime === "image/png")
    return bytes[0] === 137 && head.slice(1, 4) === "PNG";
  if (mime === "image/webp")
    return head.startsWith("RIFF") && head.slice(8, 12) === "WEBP";
  if (mime === "application/pdf") return head.startsWith("%PDF-");
  if (mime === "video/mp4") return head.slice(4, 8) === "ftyp";
  if (mime === "video/webm" || mime === "audio/webm")
    return (
      bytes[0] === 26 && bytes[1] === 69 && bytes[2] === 223 && bytes[3] === 163
    );
  if (mime === "audio/wav" || mime === "audio/x-wav")
    return head.startsWith("RIFF") && head.slice(8, 12) === "WAVE";
  if (mime === "audio/ogg") return head.startsWith("OggS");
  if (mime === "audio/mpeg")
    return (
      head.startsWith("ID3") || (bytes[0] === 255 && (bytes[1] & 224) === 224)
    );
  if (mime === "text/plain") return !bytes.slice(0, 4096).includes(0);
  return false;
}
