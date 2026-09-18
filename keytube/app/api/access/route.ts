import { z } from "zod";
import {
  proofSchema,
  consumeProof,
  getPost,
  sameOrigin,
  readJson,
  response,
  failure,
  AppError,
  db,
} from "@/lib/keytube-server";
import { mediaGrant } from "@/lib/media";
import { hasPostMembership } from "@/lib/plans";
import { getAppUser } from "@/lib/auth";
import { ensureV10Schema, notify, displayName } from "@/lib/v10";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    await ensureV10Schema();
    const { postId, ...proof } = proofSchema
      .extend({ postId: z.string().uuid() })
      .parse(await readJson(req));
    const post = await getPost(postId);
    await consumeProof(req, proof, "read", post.id, post.network);
    // This is the only reader route returning body. Always check current chain state.
    const valid = await hasPostMembership(post, proof.wallet);
    if (!valid)
      throw new AppError(
        403,
        "Esta billetera no tiene una membresía válida para la publicación.",
        "MEMBERSHIP_REQUIRED",
      );
    const appUser = await getAppUser();
    if (appUser) {
      const existing = await db().prepare("SELECT id FROM access_history WHERE owner_id=? AND post_id=? ORDER BY verified_at DESC LIMIT 1").bind(appUser.userId, post.id).first();
      await db().prepare("INSERT INTO access_history (id,owner_id,creator_id,post_id,lock_address,network,verified_at) VALUES (?,?,?,?,?,?,?)")
        .bind(crypto.randomUUID(), appUser.userId, post.owner_id, post.id, post.lock, post.network, Date.now()).run();
      if (!existing) {
        const actor = await displayName(appUser.userId);
        await notify({ownerId:post.owner_id,actorId:appUser.userId,type:"member",targetId:post.id,message:`${actor} verificó una membresía para acceder a tu contenido.`});
      }
    }
    return response({
      body: post.body,
      ...(await mediaGrant(post, proof.wallet)),
      verifiedAt: Date.now(),
      wallet: proof.wallet,
      lock: post.lock,
      network: post.network,
    });
  } catch (e) {
    return failure(e);
  }
}
