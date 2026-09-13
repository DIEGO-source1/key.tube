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
import { getAsset, bucket } from "@/lib/media";

export const dynamic = "force-dynamic";

const avatarSchema = z.union([
  z.literal(""),
  z.enum(["nico", "valeria", "alma"]),
  z.string().regex(/^asset:[0-9a-fA-F-]{36}$/, "Foto de perfil inválida."),
]);

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
        avatar: "",
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
        avatar: avatarSchema,
      })
      .parse(await readJson(req));

    const current = await db()
      .prepare("SELECT avatar FROM profiles WHERE owner_id=?")
      .bind(user.userId)
      .first<{ avatar: string }>();

    if (p.avatar.startsWith("asset:")) {
      const asset = await getAsset(p.avatar.slice(6));
      if (
        asset.owner_id !== user.userId ||
        asset.role !== "avatar" ||
        !asset.mime.startsWith("image/")
      )
        throw new AppError(403, "La foto seleccionada no pertenece a tu perfil.");
    }

    await db()
      .prepare(
        "INSERT INTO profiles (owner_id,name,bio,avatar,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(owner_id) DO UPDATE SET name=excluded.name,bio=excluded.bio,avatar=excluded.avatar,updated_at=excluded.updated_at",
      )
      .bind(user.userId, p.name, p.bio, p.avatar, Date.now())
      .run();

    // Delete the previous uploaded avatar only after the new profile was saved.
    const oldAvatar = current?.avatar || "";
    if (oldAvatar.startsWith("asset:") && oldAvatar !== p.avatar) {
      const oldId = oldAvatar.slice(6);
      try {
        const oldAsset = await getAsset(oldId);
        if (oldAsset.owner_id === user.userId && oldAsset.role === "avatar") {
          await bucket().delete(oldAsset.storage_key);
          await db()
            .prepare("DELETE FROM assets WHERE id=? AND owner_id=?")
            .bind(oldId, user.userId)
            .run();
        }
      } catch {
        // A missing old avatar should never block a profile update.
      }
    }

    return response({ profile: p });
  } catch (e) {
    return failure(e);
  }
}
