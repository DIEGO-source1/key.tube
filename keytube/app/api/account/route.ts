import { z } from "zod";
import { getAppUser } from "@/lib/auth";
import {
  db,
  requireCreator,
  sameOrigin,
  readJson,
  response,
  failure,
} from "@/lib/keytube-server";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
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
        .prepare("SELECT name,bio,avatar,wallet FROM profiles WHERE owner_id = ?")
        .bind(user.userId)
        .first(),
      db()
        .prepare(
          "SELECT post_id FROM saved_posts WHERE owner_id = ? ORDER BY created_at DESC",
        )
        .bind(user.userId)
        .all<{ post_id: string }>(),
      db()
        .prepare(
          "SELECT creator_id FROM follows WHERE owner_id = ? ORDER BY created_at DESC",
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
        avatar: "nico",
        wallet: "",
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
        avatar: z.enum(["nico", "valeria", "alma"]),
      })
      .parse(await readJson(req));
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
