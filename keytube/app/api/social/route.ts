import { z } from "zod";
import {
  db,
  requireCreator,
  sameOrigin,
  readJson,
  response,
  failure,
  AppError,
} from "@/lib/keytube-server";
import { ensureV10Schema, notify, displayName } from "@/lib/v10";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const user = await requireCreator();
    await ensureV10Schema();
    const data = z
      .object({
        kind: z.enum(["save", "follow", "like"]),
        target: z.string().min(1).max(120),
        active: z.boolean(),
      })
      .parse(await readJson(req));

    if (data.kind === "save") {
      const post = await db().prepare("SELECT id FROM posts WHERE id=?").bind(data.target).first();
      if (!post) throw new AppError(404, "La publicación no existe.");
      if (data.active) {
        await db().prepare("INSERT OR IGNORE INTO saved_posts (id,owner_id,post_id,created_at) VALUES (?,?,?,?)")
          .bind(crypto.randomUUID(), user.userId, data.target, Date.now()).run();
      } else {
        await db().prepare("DELETE FROM saved_posts WHERE owner_id=? AND post_id=?").bind(user.userId, data.target).run();
      }
      return response({ active: data.active });
    }

    if (data.kind === "follow") {
      const creator = await db().prepare("SELECT owner_id,creator FROM posts WHERE owner_id=? LIMIT 1").bind(data.target).first<{owner_id:string;creator:string}>();
      if (!creator) throw new AppError(404, "El creador no existe.");
      if (creator.owner_id === user.userId) throw new AppError(400, "No puedes seguir tu propia cuenta.");
      if (data.active) {
        await db().prepare("INSERT OR IGNORE INTO follows (id,owner_id,creator_id,created_at) VALUES (?,?,?,?)")
          .bind(crypto.randomUUID(), user.userId, data.target, Date.now()).run();
        const actor = await displayName(user.userId);
        await notify({ ownerId: data.target, actorId: user.userId, type: "follow", targetId: user.userId, message: `${actor} empezó a seguirte.` });
      } else {
        await db().prepare("DELETE FROM follows WHERE owner_id=? AND creator_id=?").bind(user.userId, data.target).run();
      }
      return response({ active: data.active });
    }

    const post = await db().prepare("SELECT id,owner_id,title FROM posts WHERE id=?").bind(data.target).first<{id:string;owner_id:string;title:string}>();
    if (!post) throw new AppError(404, "La publicación no existe.");
    if (data.active) {
      await db().prepare("INSERT OR IGNORE INTO post_likes (id,owner_id,post_id,created_at) VALUES (?,?,?,?)")
        .bind(crypto.randomUUID(), user.userId, data.target, Date.now()).run();
      const actor = await displayName(user.userId);
      await notify({ ownerId: post.owner_id, actorId: user.userId, type: "like", targetId: post.id, message: `${actor} indicó que le gusta «${post.title}».` });
    } else {
      await db().prepare("DELETE FROM post_likes WHERE owner_id=? AND post_id=?").bind(user.userId, data.target).run();
    }
    const count = await db().prepare("SELECT COUNT(*) AS n FROM post_likes WHERE post_id=?").bind(data.target).first<{n:number}>();
    return response({ active: data.active, likes: count?.n || 0 });
  } catch (e) {
    return failure(e);
  }
}
