import { z } from "zod";
import {
  addressSchema,
  networkSchema,
  draftSchema,
  db,
  hash,
  getPost,
  requireCreator,
  sameOrigin,
  readJson,
  response,
  failure,
  AppError,
} from "@/lib/keytube-server";
import { planSchema } from "@/lib/plans";
export const dynamic = "force-dynamic";
const schema = z.object({
  purpose: z.enum(["read", "publish", "plan"]),
  wallet: addressSchema,
  network: networkSchema,
  postId: z.string().uuid().optional(),
  draft: draftSchema.optional(),
  plan: planSchema.optional(),
});
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const data = schema.parse(await readJson(req));
    const now = Date.now();
    let userId = "",
      target = "";
    if (data.purpose === "plan") {
      const user = await requireCreator();
      userId = user.userId;
      if (!data.plan || data.plan.network !== data.network) throw new AppError(400,"Falta el plan o la red no coincide.");
      target = await hash(JSON.stringify(data.plan));
    } else if (data.purpose === "publish") {
      const user = await requireCreator();
      userId = user.userId;
      if (!data.draft) throw new AppError(400, "Falta la publicación.");
      if (data.draft.network !== data.network)
        throw new AppError(400, "La red no coincide.");
      target = await hash(JSON.stringify(data.draft));
    } else {
      if (!data.postId) throw new AppError(400, "Falta la publicación.");
      const post = await getPost(data.postId);
      if (post.network !== data.network)
        throw new AppError(400, "La red no coincide.");
      target = post.id;
    }
    const requester = await hash(
      userId || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || data.wallet,
    );
    await db()
      .prepare("DELETE FROM challenges WHERE created_at < ?")
      .bind(now - 600000)
      .run();
    const count = await db()
      .prepare(
        "SELECT count(*) AS n FROM challenges WHERE requester = ? AND created_at > ?",
      )
      .bind(requester, now - 60000)
      .first<{ n: number }>();
    if ((count?.n || 0) >= 25)
      throw new AppError(429, "Espera un minuto antes de volver a verificar.");
    const id = crypto.randomUUID(),
      expiresAt = now + 300000;
    const message = `KeyTube — ${data.purpose === "read" ? "Verificar acceso al contenido" : data.purpose === "plan" ? "Autorizar plan de membresía" : "Autorizar publicación"}\nSitio: ${new URL(req.url).origin}\nBilletera: ${data.wallet}\nRed: ${data.network}\nDestino: ${target}\nNonce: ${id}\nEmitido: ${new Date(now).toISOString()}\nVence: ${new Date(expiresAt).toISOString()}\nEsta firma no realiza pagos ni autoriza transferencias.`;
    await db()
      .prepare(
        "INSERT INTO challenges (id,requester,user_id,wallet,network,purpose,target,message,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
      )
      .bind(
        id,
        requester,
        userId,
        data.wallet,
        data.network,
        data.purpose,
        target,
        message,
        now,
        expiresAt,
      )
      .run();
    return response({ challengeId: id, message, expiresAt });
  } catch (e) {
    return failure(e);
  }
}
