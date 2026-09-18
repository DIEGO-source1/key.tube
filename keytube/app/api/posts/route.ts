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
import { ensureV10Schema, notify } from "@/lib/v10";
import type { Address } from "viem";

export const dynamic = "force-dynamic";

const sortSchema = z
  .enum(["newest", "oldest", "views_desc", "views_asc"])
  .catch("newest");

const sortSql = {
  newest: "p.created_at DESC",
  oldest: "p.created_at ASC",
  views_desc: "p.views DESC, p.created_at DESC",
  views_asc: "p.views ASC, p.created_at DESC",
} as const;

export async function GET(req: Request) {
  try {
    await ensureV10Schema();
    const query = new URL(req.url).searchParams;
    const id = query.get("id");
    const viewer = await getAppUser();

    if (id) {
      const postId = z.string().uuid().parse(id);
      if (query.get("track") === "1") {
        await db().prepare("UPDATE posts SET views = views + 1 WHERE id = ?").bind(postId).run();
        if (viewer) {
          const now = Date.now();
          await db().prepare(`INSERT INTO view_history (id,owner_id,post_id,progress,position_seconds,updated_at)
            VALUES (?,?,?,0,0,?) ON CONFLICT(owner_id,post_id) DO UPDATE SET updated_at=excluded.updated_at`)
            .bind(crypto.randomUUID(), viewer.userId, postId, now).run();
        }
      }
      const result = publicPost(await getPost(postId));
      if (viewer) {
        const liked = await db().prepare("SELECT id FROM post_likes WHERE owner_id=? AND post_id=?").bind(viewer.userId, postId).first();
        (result as typeof result & {liked:boolean}).liked = !!liked;
      }
      return response({ post: result });
    }

    const mine = query.get("mine") === "1";
    if (mine && !viewer) throw new AppError(401, "Inicia sesión para ver tus publicaciones.");
    const sort = sortSchema.parse(query.get("sort") || "newest");
    const order = sortSql[sort];
    const q = (query.get("q") || "").trim().toLowerCase().slice(0, 100);
    const type = query.get("type") || "";
    const visibility = query.get("visibility") || "";
    const category = query.get("category") || "";

    const where: string[] = [];
    const values: unknown[] = [];
    if (mine) { where.push("p.owner_id=?"); values.push(viewer!.userId); }
    if (q) { where.push("(lower(p.title) LIKE ? OR lower(p.creator) LIKE ? OR lower(p.category) LIKE ? OR lower(p.intro) LIKE ?)"); const like=`%${q}%`; values.push(like,like,like,like); }
    if (["video","image","audio","text","document"].includes(type)) { where.push("p.type=?"); values.push(type); }
    if (["free","members"].includes(visibility)) { where.push("p.visibility=?"); values.push(visibility); }
    if (category) { where.push("p.category=?"); values.push(category.slice(0,35)); }

    // A blocked creator never appears in the viewer feed/search.
    if (viewer && !mine) { where.push("NOT EXISTS (SELECT 1 FROM blocks b WHERE b.owner_id=? AND b.blocked_user_id=p.owner_id)"); values.push(viewer.userId); }

    const sql = `SELECT p.id,p.owner_id,p.wallet,p.creator,p.title,p.intro,p.lock,p.network,p.created_at,p.views,p.type,p.category,p.thumbnail_id,p.preview_id,p.asset_id,p.visibility,p.plan_id,p.premium_lock,
      pr.avatar,pr.verified,
      (SELECT COUNT(*) FROM post_likes l WHERE l.post_id=p.id) AS likes,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id) AS comment_count
      FROM posts p LEFT JOIN profiles pr ON pr.owner_id=p.owner_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY ${order} LIMIT 120`;
    const rows = (await db().prepare(sql).bind(...values).all<StoredPost>()).results.map(publicPost);

    if (viewer && rows.length) {
      const likedRows = await db().prepare("SELECT post_id FROM post_likes WHERE owner_id=?").bind(viewer.userId).all<{post_id:string}>();
      const liked = new Set(likedRows.results.map(x => x.post_id));
      for (const item of rows) (item as typeof item & {liked:boolean}).liked = liked.has(item.id);
    }
    return response({ posts: rows });
  } catch (e) {
    return failure(e);
  }
}

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    await ensureV10Schema();
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
    const followers = await db().prepare("SELECT owner_id FROM follows WHERE creator_id=? ORDER BY created_at DESC LIMIT 500").bind(user.userId).all<{owner_id:string}>();
    for (const follower of followers.results) {
      await notify({ownerId:follower.owner_id,actorId:user.userId,type:"new_post",targetId:id,message:`${draft.creator} publicó «${draft.title}».`});
    }
    return response({ post: publicPost(await getPost(id)) }, 201);
  } catch (e) {
    return failure(e);
  }
}
