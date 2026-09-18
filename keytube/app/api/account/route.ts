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
import { getAsset, deleteStorageKey } from "@/lib/media";
import { ensureV10Schema } from "@/lib/v10";

export const dynamic = "force-dynamic";

const assetRef = z.union([z.literal(""), z.string().regex(/^asset:[0-9a-fA-F-]{36}$/)]);
const avatarSchema = z.union([z.literal(""), z.enum(["nico", "valeria", "alma"]), z.string().regex(/^asset:[0-9a-fA-F-]{36}$/)]);
const urlField = z.union([z.literal(""), z.string().trim().url().max(240)]);

export async function GET() {
  try {
    await ensureV10Schema();
    const user = await getAppUser();
    if (!user)
      return response({
        isAdmin: false,
        profile: null,
        saved: [],
        following: [],
        liked: [],
        blocked: [],
        postCount: 0,
        followerCount: 0,
        collectionCount: 0,
        unreadNotifications: 0,
        accessCount: 0,
      });

    const [profile, saved, following, liked, blocked, postCount, followerCount, collectionCount, unread, accessCount] = await Promise.all([
      db().prepare("SELECT name,bio,avatar,cover,website,instagram,youtube,verified,role,wallet FROM profiles WHERE owner_id=?").bind(user.userId).first(),
      db().prepare("SELECT post_id FROM saved_posts WHERE owner_id=? ORDER BY created_at DESC").bind(user.userId).all<{post_id:string}>(),
      db().prepare("SELECT creator_id FROM follows WHERE owner_id=? ORDER BY created_at DESC").bind(user.userId).all<{creator_id:string}>(),
      db().prepare("SELECT post_id FROM post_likes WHERE owner_id=? ORDER BY created_at DESC").bind(user.userId).all<{post_id:string}>(),
      db().prepare("SELECT blocked_user_id FROM blocks WHERE owner_id=? ORDER BY created_at DESC").bind(user.userId).all<{blocked_user_id:string}>(),
      db().prepare("SELECT COUNT(*) AS n FROM posts WHERE owner_id=?").bind(user.userId).first<{n:number}>(),
      db().prepare("SELECT COUNT(*) AS n FROM follows WHERE creator_id=?").bind(user.userId).first<{n:number}>(),
      db().prepare("SELECT COUNT(*) AS n FROM collections WHERE owner_id=?").bind(user.userId).first<{n:number}>(),
      db().prepare("SELECT COUNT(*) AS n FROM notifications WHERE owner_id=? AND read_at IS NULL").bind(user.userId).first<{n:number}>(),
      db().prepare("SELECT COUNT(*) AS n FROM access_history WHERE owner_id=?").bind(user.userId).first<{n:number}>(),
    ]);

    const adminEmails=(process.env.ADMIN_EMAILS||"").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);
    const isAdmin=(profile as {role?:string}|null)?.role==="admin"||adminEmails.includes(user.email.toLowerCase());
    return response({
      isAdmin,
      profile: profile || {
        name: user.fullName || "Mi perfil", bio: "", avatar: "", cover: "", website: "", instagram: "", youtube: "", verified: 0, role: "user", wallet: "",
      },
      saved: saved.results.map(x => x.post_id),
      following: following.results.map(x => x.creator_id),
      liked: liked.results.map(x => x.post_id),
      blocked: blocked.results.map(x => x.blocked_user_id),
      postCount: postCount?.n || 0,
      followerCount: followerCount?.n || 0,
      collectionCount: collectionCount?.n || 0,
      unreadNotifications: unread?.n || 0,
      accessCount: accessCount?.n || 0,
    });
  } catch (e) { return failure(e); }
}

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    await ensureV10Schema();
    const user = await requireCreator();
    const p = z.object({
      name: z.string().trim().min(2).max(65),
      bio: z.string().trim().max(500),
      avatar: avatarSchema,
      cover: assetRef.default(""),
      website: urlField.default(""),
      instagram: urlField.default(""),
      youtube: urlField.default(""),
    }).parse(await readJson(req));

    const current = await db().prepare("SELECT avatar,cover FROM profiles WHERE owner_id=?").bind(user.userId).first<{avatar:string;cover:string}>();

    for (const [field, value, role] of [["avatar", p.avatar, "avatar"], ["cover", p.cover, "cover"]] as const) {
      if (!value.startsWith("asset:")) continue;
      const asset = await getAsset(value.slice(6));
      if (asset.owner_id !== user.userId || asset.role !== role || !asset.mime.startsWith("image/"))
        throw new AppError(403, `${field === "avatar" ? "La foto" : "La portada"} seleccionada no pertenece a tu perfil.`);
    }

    await db().prepare(`INSERT INTO profiles (owner_id,name,bio,avatar,cover,website,instagram,youtube,wallet,updated_at)
      VALUES (?,?,?,?,?,?,?,?,'',?)
      ON CONFLICT(owner_id) DO UPDATE SET name=excluded.name,bio=excluded.bio,avatar=excluded.avatar,cover=excluded.cover,website=excluded.website,instagram=excluded.instagram,youtube=excluded.youtube,updated_at=excluded.updated_at`)
      .bind(user.userId,p.name,p.bio,p.avatar,p.cover,p.website,p.instagram,p.youtube,Date.now()).run();

    const previous = [current?.avatar || "", current?.cover || ""];
    const next = new Set([p.avatar,p.cover]);
    for (const oldRef of previous) {
      if (!oldRef.startsWith("asset:") || next.has(oldRef)) continue;
      const oldId = oldRef.slice(6);
      try {
        const oldAsset = await getAsset(oldId);
        if (oldAsset.owner_id === user.userId && ["avatar","cover"].includes(oldAsset.role)) {
          await deleteStorageKey(oldAsset.storage_key);
          await db().prepare("DELETE FROM assets WHERE id=? AND owner_id=?").bind(oldId,user.userId).run();
        }
      } catch { /* old file already gone */ }
    }
    return response({ profile: p });
  } catch (e) { return failure(e); }
}
