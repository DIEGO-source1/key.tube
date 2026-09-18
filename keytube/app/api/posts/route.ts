import { z } from "zod";
import { getAppUser } from "@/lib/auth";
import {
  db,
  draftSchema,
  proofSchema,
  consumeProof,
  requireCreator,
  sameOrigin,
  readJson,
  response,
  failure,
  hash,
  AppError,
  type StoredPost,
  publicPost,
  getPost,
} from "@/lib/keytube-server";
import { verifyRealLock, rpcClient, lockAbi } from "@/lib/unlock";
import { ownerPlans } from "@/lib/plans";
import { validateAssets } from "@/lib/media";
import type { Address } from "viem";

export const dynamic = "force-dynamic";

const sortSchema = z
  .enum(["newest", "oldest", "views_desc", "views_asc"])
  .catch("newest");

const sortSql = {
  newest: "created_at DESC",
  oldest: "created_at ASC",
  views_desc: "views DESC, created_at DESC",
  views_asc: "views ASC, created_at DESC",
} as const;

export async function GET(req: Request) {
  try {
    const query = new URL(req.url).searchParams;
    const id = query.get("id");

    if (id) {
      const postId = z.string().uuid().parse(id);
      if (query.get("track") === "1") {
        await db()
          .prepare("UPDATE posts SET views = views + 1 WHERE id = ?")
          .bind(postId)
          .run();
      }
      return response({ post: publicPost(await getPost(postId)) });
    }

    const mine = query.get("mine") === "1";
    const user = mine ? await getAppUser() : null;
    if (mine && !user)
      throw new AppError(401, "Inicia sesión para ver tus publicaciones.");

    const sort = sortSchema.parse(query.get("sort") || "newest");
    const fields =
      "id, owner_id, wallet, creator, title, intro, lock, network, created_at, views, type, category, thumbnail_id, preview_id, asset_id, visibility, plan_id, premium_lock";
    const order = sortSql[sort];
    const querySQL = mine
      ? db()
          .prepare(
            `SELECT ${fields} FROM posts WHERE owner_id=? ORDER BY ${order} LIMIT 100`,
          )
          .bind(user!.userId)
      : db().prepare(`SELECT ${fields} FROM posts ORDER BY ${order} LIMIT 100`);

    const rows = (await querySQL.all<StoredPost>()).results.map(publicPost);
    return response({ posts: rows });
  } catch (e) {
    return failure(e);
  }
}

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const user = await requireCreator();
    const data = await readJson(req);
    const draft = draftSchema.parse(data.draft);
    let wallet = "" as Address,
      premiumLock: string | null = null;

    if (draft.visibility === "members") {
      const proof = proofSchema.parse(data);
      await consumeProof(
        req,
        proof,
        "publish",
        await hash(JSON.stringify(draft)),
        draft.network,
        user.userId,
      );
      wallet = proof.wallet;
      await verifyRealLock(draft.lock as Address, draft.network);
      const manager = await rpcClient(draft.network).readContract({
        address: draft.lock as Address,
        abi: lockAbi,
        functionName: "isLockManager",
        args: [wallet],
      });
      if (!manager)
        throw new AppError(
          403,
          "La wallet conectada debe administrar este Lock.",
        );
      if (draft.planId) {
        const plans = await ownerPlans(user.userId);
        const plan = plans.find((p) => p.id === draft.planId);
        if (
          !plan ||
          plan.lock !== draft.lock ||
          plan.network !== draft.network ||
          plan.wallet !== wallet
        )
          throw new AppError(
            403,
            "El plan no pertenece a tu cuenta o a esta wallet.",
          );
        if (!(JSON.parse(plan.coverage) as string[]).includes(draft.type))
          throw new AppError(
            400,
            "Este formato no está incluido en el plan seleccionado.",
          );
        if (plan.slot === "basic")
          premiumLock = plans.find((p) => p.slot === "premium")?.lock || null;
      }
    } else {
      draft.lock = "";
      draft.planId = null;
    }

    await validateAssets(draft, user.userId);
    const id = crypto.randomUUID(),
      now = Date.now();
    await db()
      .prepare(
        "INSERT INTO posts (id,owner_id,wallet,creator,title,intro,body,lock,network,created_at,type,category,thumbnail_id,preview_id,asset_id,updated_at,visibility,plan_id,premium_lock,views) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)",
      )
      .bind(
        id,
        user.userId,
        wallet,
        draft.creator,
        draft.title,
        draft.intro,
        draft.body,
        draft.lock,
        draft.network,
        now,
        draft.type,
        draft.category,
        draft.thumbnailId,
        draft.previewId,
        draft.assetId,
        now,
        draft.visibility,
        draft.planId,
        premiumLock,
      )
      .run();
    return response({ post: publicPost(await getPost(id)) }, 201);
  } catch (e) {
    return failure(e);
  }
}
