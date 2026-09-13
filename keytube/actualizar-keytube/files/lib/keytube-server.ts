import { env } from "cloudflare:workers";
import { z } from "zod";
import { isAddress, type Address, type Hex } from "viem";
import { getAppUser } from "@/lib/auth";
import { rpcClient, chainConfig } from "./unlock";
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "ERROR",
  ) {
    super(message);
  }
}
export function db() {
  if (!env.DB)
    throw new AppError(
      503,
      "El almacenamiento no está disponible. Intenta nuevamente.",
    );
  return env.DB;
}
export const addressSchema = z
  .string()
  .refine(
    (x) => isAddress(x, { strict: false }),
    "Dirección de billetera o Lock inválida.",
  )
  .transform((x) => x.toLowerCase() as Address);
export const networkSchema = z
  .number()
  .int()
  .refine((x) => [84532, 11155111, 8453, 137].includes(x), "Red no admitida.");
export const draftSchema = z
  .object({
    creator: z.string().trim().min(2).max(65),
    title: z.string().trim().min(3).max(110),
    intro: z.string().trim().min(30).max(2500),
    body: z.string().trim().max(60000),
    lock: z.union([addressSchema,z.literal("")]),
    network: networkSchema,
    visibility: z.enum(["free","members"]).default("members"),
    planId: z.string().uuid().nullable().default(null),
    type: z
      .enum(["video", "image", "audio", "text", "document"])
      .default("text"),
    category: z.string().trim().min(2).max(35).default("Educación"),
    thumbnailId: z.string().uuid().nullable().default(null),
    previewId: z.string().uuid().nullable().default(null),
    assetId: z.string().uuid().nullable().default(null),
  })
  .superRefine((d, ctx) => {
    if (d.visibility === "members" && !d.lock) ctx.addIssue({code:"custom",path:["lock"],message:"Selecciona un plan de membresía."});
    if (d.type === "text" && d.body.length < 60)
      ctx.addIssue({
        code: "custom",
        path: ["body"],
        message: "Escribe al menos 60 caracteres de contenido completo.",
      });
    if (d.type !== "text" && !d.assetId)
      ctx.addIssue({
        code: "custom",
        path: ["assetId"],
        message: "Sube el archivo completo antes de publicar.",
      });
    if (d.visibility !== "free" && ["video", "audio", "image"].includes(d.type) && !d.previewId)
      ctx.addIssue({
        code: "custom",
        path: ["previewId"],
        message: "Sube un adelanto separado del archivo completo.",
      });
  });
export const proofSchema = z.object({
  challengeId: z.string().uuid(),
  wallet: addressSchema,
  signature: z.string().regex(/^0x[0-9a-fA-F]{2,20000}$/),
});
export function response(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      Vary: "Cookie",
    },
  });
}
export function failure(error: unknown) {
  if (error instanceof AppError)
    return response({ error: error.message, code: error.code }, error.status);
  if (error instanceof z.ZodError)
    return response(
      { error: error.issues[0]?.message || "Datos inválidos." },
      400,
    );
  console.error(
    "KeyTube request failed",
    error instanceof Error ? error.message : "unknown",
  );
  return response(
    {
      error:
        "No pudimos completar la operación. Comprueba la red y vuelve a intentar.",
    },
    503,
  );
}
export function sameOrigin(req: Request) {
  if (req.headers.get("origin") !== new URL(req.url).origin)
    throw new AppError(403, "Origen de la solicitud inválido.");
}
export async function readJson(req: Request) {
  if (Number(req.headers.get("content-length") || 0) > 150000)
    throw new AppError(413, "El contenido supera el límite permitido.");
  const text = await req.text();
  if (text.length > 150000)
    throw new AppError(413, "El contenido supera el límite permitido.");
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError(400, "Solicitud inválida.");
  }
}
export async function hash(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
}
export async function requireCreator() {
  const u = await getAppUser();
  if (!u) throw new AppError(401, "Inicia sesión para publicar.");
  return u;
}
export type StoredPost = {
  id: string;
  owner_id: string;
  wallet: Address;
  creator: string;
  creator_name?: string;
  creator_avatar?: string;
  title: string;
  intro: string;
  body: string;
  lock: Address;
  network: number;
  created_at: number;
  status?: "published" | "hidden";
  visibility?: "free" | "members";
  plan_id?: string | null;
  premium_lock?: string | null;
  type?: import("./keytube-types").ContentType;
  category?: string;
  thumbnail_id?: string | null;
  preview_id?: string | null;
  asset_id?: string | null;
};
export async function getPost(id: string, includeHidden = false) {
  const p = await db()
    .prepare("SELECT p.*,pr.name AS creator_name,pr.avatar AS creator_avatar FROM posts p LEFT JOIN profiles pr ON pr.owner_id=p.owner_id WHERE p.id = ?")
    .bind(id)
    .first<StoredPost>();
  if (!p || (!includeHidden && p.status === 'hidden')) throw new AppError(404, "Esta publicación no está disponible.");
  return p;
}
export function publicPost(p: StoredPost) {
  return {
    id: p.id,
    status: p.status || 'published',
    creator: p.creator_name || p.creator,
    avatar: p.creator_avatar || "",
    creator_id: p.owner_id || p.wallet,
    visibility: p.visibility || "members",
    plan_id: p.plan_id || null,
    premium_lock: p.premium_lock || null,
    title: p.title,
    intro: p.intro,
    lock: p.lock,
    network: p.network,
    created_at: p.created_at,
    type: p.type || "text",
    category: p.category || "Educación",
    thumbnail_url: p.thumbnail_id ? `/api/media/${p.thumbnail_id}${p.status==='hidden'?'?owner=1':''}` : undefined,
    preview_url: p.preview_id ? `/api/media/${p.preview_id}${p.status==='hidden'?'?owner=1':''}` : undefined,
  };
}
export async function consumeProof(
  req: Request,
  proof: z.infer<typeof proofSchema>,
  purpose: string,
  target: string,
  network: number,
  userId = "",
) {
  const row = await db()
    .prepare("SELECT * FROM challenges WHERE id = ?")
    .bind(proof.challengeId)
    .first<{
      id: string;
      wallet: string;
      network: number;
      purpose: string;
      target: string;
      user_id: string;
      message: string;
      expires_at: number;
      consumed_at: number | null;
    }>();
  if (
    !row ||
    row.expires_at < Date.now() ||
    row.consumed_at !== null ||
    row.wallet !== proof.wallet ||
    row.network !== network ||
    row.purpose !== purpose ||
    row.target !== target ||
    row.user_id !== userId
  )
    throw new AppError(
      401,
      "La firma expiró o no corresponde a esta acción. Vuelve a verificar.",
    );
  // Address ownership is cryptographically proven, never trusted from a request field.
  const valid = await rpcClient(network).verifyMessage({
    address: proof.wallet,
    message: row.message,
    signature: proof.signature as Hex,
  });
  if (!valid)
    throw new AppError(401, "La firma no pertenece a esta billetera.");
  const consumed = await db()
    .prepare(
      "UPDATE challenges SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL AND expires_at >= ? RETURNING id",
    )
    .bind(Date.now(), row.id, Date.now())
    .first();
  if (!consumed) throw new AppError(401, "Esta firma ya fue utilizada.");
}
