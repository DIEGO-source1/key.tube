import { z } from "zod";
import { db, requireCreator, sameOrigin, readJson, response, failure } from "@/lib/keytube-server";
import { ensureV10Schema } from "@/lib/v10";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await requireCreator();
    await ensureV10Schema();
    const postId = new URL(req.url).searchParams.get("post");
    if (postId) {
      const row = await db().prepare("SELECT post_id,progress,position_seconds,updated_at FROM view_history WHERE owner_id=? AND post_id=?")
        .bind(user.userId, postId).first();
      return response({ history: row || null });
    }
    const rows = await db().prepare(`SELECT h.post_id,h.progress,h.position_seconds,h.updated_at,
      p.owner_id,p.creator,p.title,p.intro,p.lock,p.network,p.created_at,p.views,p.type,p.category,p.thumbnail_id,p.preview_id,p.asset_id,p.visibility,p.plan_id,p.premium_lock,
      pr.avatar,pr.verified
      FROM view_history h JOIN posts p ON p.id=h.post_id
      LEFT JOIN profiles pr ON pr.owner_id=p.owner_id
      WHERE h.owner_id=? ORDER BY h.updated_at DESC LIMIT 60`).bind(user.userId).all();
    return response({ history: rows.results });
  } catch (e) { return failure(e); }
}

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const user = await requireCreator();
    await ensureV10Schema();
    const data = z.object({
      postId: z.string().uuid(),
      progress: z.number().int().min(0).max(100).default(0),
      positionSeconds: z.number().int().min(0).max(60*60*24).default(0),
    }).parse(await readJson(req));
    const exists = await db().prepare("SELECT id FROM posts WHERE id=?").bind(data.postId).first();
    if (!exists) return response({ ok: false }, 404);
    const now = Date.now();
    await db().prepare(`INSERT INTO view_history (id,owner_id,post_id,progress,position_seconds,updated_at)
      VALUES (?,?,?,?,?,?) ON CONFLICT(owner_id,post_id) DO UPDATE SET progress=excluded.progress,position_seconds=excluded.position_seconds,updated_at=excluded.updated_at`)
      .bind(crypto.randomUUID(), user.userId, data.postId, data.progress, data.positionSeconds, now).run();
    return response({ ok: true });
  } catch (e) { return failure(e); }
}
