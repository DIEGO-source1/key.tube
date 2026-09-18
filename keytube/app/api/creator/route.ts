import { z } from "zod";
import { db, response, failure, AppError } from "@/lib/keytube-server";
import { getAppUser } from "@/lib/auth";
import { ensureV10Schema } from "@/lib/v10";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await ensureV10Schema();
    const id = z.string().min(1).max(120).parse(new URL(req.url).searchParams.get("id"));
    const profile = await db().prepare(`SELECT p.owner_id,p.name,p.bio,p.avatar,p.cover,p.website,p.instagram,p.youtube,p.verified,p.role,
      (SELECT COUNT(*) FROM posts x WHERE x.owner_id=p.owner_id) AS post_count,
      (SELECT COUNT(*) FROM follows f WHERE f.creator_id=p.owner_id) AS follower_count,
      (SELECT COALESCE(SUM(x.views),0) FROM posts x WHERE x.owner_id=p.owner_id) AS total_views,
      (SELECT COUNT(*) FROM post_likes l JOIN posts x ON x.id=l.post_id WHERE x.owner_id=p.owner_id) AS total_likes
      FROM profiles p WHERE p.owner_id=?`).bind(id).first<{
        owner_id:string;name:string;bio:string;avatar:string;cover:string;website:string;instagram:string;youtube:string;verified:number;role:string;post_count:number;follower_count:number;total_views:number;total_likes:number;
      }>();
    if (!profile) {
      const fallback = await db().prepare("SELECT owner_id,creator AS name FROM posts WHERE owner_id=? LIMIT 1").bind(id).first<{owner_id:string;name:string}>();
      if (!fallback) throw new AppError(404,"Este creador no existe.");
      return response({ profile: { ...fallback, bio:"",avatar:"",cover:"",website:"",instagram:"",youtube:"",verified:0,role:"user",post_count:0,follower_count:0,total_views:0,total_likes:0 }, following:false, blocked:false });
    }
    const viewer = await getAppUser();
    let following=false, blocked=false;
    if (viewer) {
      const [f,b] = await Promise.all([
        db().prepare("SELECT id FROM follows WHERE owner_id=? AND creator_id=?").bind(viewer.userId,id).first(),
        db().prepare("SELECT id FROM blocks WHERE owner_id=? AND blocked_user_id=?").bind(viewer.userId,id).first(),
      ]);
      following=!!f; blocked=!!b;
    }
    return response({ profile, following, blocked });
  } catch(e) { return failure(e); }
}
