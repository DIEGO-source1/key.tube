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
} from "@/lib/keytube-server";
import { rpcClient, lockAbi } from "@/lib/unlock";
import { mediaGrant } from "@/lib/media";
import { hasPostMembership } from "@/lib/plans";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
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
