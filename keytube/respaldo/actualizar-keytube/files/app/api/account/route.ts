import { z } from "zod";
import { getAppUser } from "@/lib/auth";
import {
  db,
  requireCreator,
  sameOrigin,
  readJson,
  response,
  failure,
  AppError,
} from "@/lib/keytube-server";
export const dynamic = "force-dynamic";
export async function GET(req?: Request) {
  try {
    const creator = req ? new URL(req.url).searchParams.get('creator') : null;
    if (creator) {
      z.string().min(1).max(120).parse(creator);
      const profile = await db().prepare('SELECT owner_id AS id,name,bio,avatar FROM profiles WHERE owner_id=?').bind(creator).first();
      if (!profile) throw new AppError(404,'Este perfil no existe.');
      const count = await db().prepare("SELECT COUNT(*) AS n FROM posts WHERE owner_id=? AND status='published'").bind(creator).first<{n:number}>();
      return response({profile,postCount:count?.n||0});
    }
    const user = await getAppUser();
    if (!user)
      return response({
        profile: null,
        saved: [],
        following: [],
        postCount: 0,
      });
    const [profile, saved, following, count] = await Promise.all([
      db()
        .prepare("SELECT name,bio,avatar FROM profiles WHERE owner_id = ?")
        .bind(user.userId)
        .first(),
      db()
        .prepare(
          "SELECT s.post_id FROM saved_posts s WHERE s.owner_id = ? AND EXISTS (SELECT 1 FROM posts p WHERE p.id=s.post_id) ORDER BY s.created_at DESC",
        )
        .bind(user.userId)
        .all<{ post_id: string }>(),
      db()
        .prepare(
          "SELECT f.creator_id FROM follows f WHERE f.owner_id = ? AND EXISTS (SELECT 1 FROM profiles p WHERE p.owner_id=f.creator_id) ORDER BY f.created_at DESC",
        )
        .bind(user.userId)
        .all<{ creator_id: string }>(),
      db()
        .prepare("SELECT COUNT(*) AS n FROM posts WHERE owner_id = ?")
        .bind(user.userId)
        .first<{ n: number }>(),
    ]);
    return response({
      profile: profile || {
        name: user.fullName || "Mi perfil",
        bio: "",
        avatar: "",
      },
      saved: saved.results.map((x) => x.post_id),
      following: following.results.map((x) => x.creator_id),
      postCount: count?.n || 0,
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const user = await requireCreator();
    const p = z
      .object({
        name: z.string().trim().min(2).max(65),
        bio: z.string().trim().max(500),
        avatar: z.union([z.literal(""), z.string().uuid()]),
      })
      .parse(await readJson(req));
    if (p.avatar) {
      const asset = await db().prepare("SELECT id FROM assets WHERE id=? AND owner_id=? AND role='avatar' AND mime IN ('image/jpeg','image/png','image/webp')").bind(p.avatar,user.userId).first();
      if (!asset) throw new AppError(403,'Elige una foto de perfil que hayas subido desde tu cuenta.');
    }
    await db()
      .prepare(
        "INSERT INTO profiles (owner_id,name,bio,avatar,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(owner_id) DO UPDATE SET name=excluded.name,bio=excluded.bio,avatar=excluded.avatar,updated_at=excluded.updated_at",
      )
      .bind(user.userId, p.name, p.bio, p.avatar, Date.now())
      .run();
    return response({ profile: p });
  } catch (e) {
    return failure(e);
  }
}
