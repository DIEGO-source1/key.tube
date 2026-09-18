import { getAppUser } from "@/lib/auth";
import { db, response, failure, publicPost, type StoredPost } from "@/lib/keytube-server";
import { ensureV10Schema } from "@/lib/v10";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureV10Schema();
    const user = await getAppUser();
    const rows = (await db().prepare(`SELECT p.id,p.owner_id,p.wallet,p.creator,p.title,p.intro,p.lock,p.network,p.created_at,p.views,p.type,p.category,p.thumbnail_id,p.preview_id,p.asset_id,p.visibility,p.plan_id,p.premium_lock,
      pr.avatar,pr.verified,
      (SELECT COUNT(*) FROM post_likes l WHERE l.post_id=p.id) AS likes,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id) AS comment_count
      FROM posts p LEFT JOIN profiles pr ON pr.owner_id=p.owner_id
      ORDER BY p.created_at DESC LIMIT 160`).all<StoredPost>()).results;

    if (!user) {
      const ranked = rows.sort((a,b) => ((b.views||0)+(b.likes||0)*4+(b.comment_count||0)*3) - ((a.views||0)+(a.likes||0)*4+(a.comment_count||0)*3));
      return response({ posts: ranked.slice(0,60).map(publicPost), personalized:false });
    }

    const [followingRows, likedRows, savedRows, historyRows, blockedRows] = await Promise.all([
      db().prepare("SELECT creator_id FROM follows WHERE owner_id=?").bind(user.userId).all<{creator_id:string}>(),
      db().prepare("SELECT p.category,p.type,l.post_id FROM post_likes l JOIN posts p ON p.id=l.post_id WHERE l.owner_id=? ORDER BY l.created_at DESC LIMIT 80").bind(user.userId).all<{category:string;type:string;post_id:string}>(),
      db().prepare("SELECT p.category,p.type,s.post_id FROM saved_posts s JOIN posts p ON p.id=s.post_id WHERE s.owner_id=? ORDER BY s.created_at DESC LIMIT 80").bind(user.userId).all<{category:string;type:string;post_id:string}>(),
      db().prepare("SELECT p.category,p.type,h.post_id FROM view_history h JOIN posts p ON p.id=h.post_id WHERE h.owner_id=? ORDER BY h.updated_at DESC LIMIT 100").bind(user.userId).all<{category:string;type:string;post_id:string}>(),
      db().prepare("SELECT blocked_user_id FROM blocks WHERE owner_id=?").bind(user.userId).all<{blocked_user_id:string}>(),
    ]);

    const following = new Set(followingRows.results.map(x=>x.creator_id));
    const blocked = new Set(blockedRows.results.map(x=>x.blocked_user_id));
    const seen = new Set(historyRows.results.map(x=>x.post_id));
    const likedIds = new Set(likedRows.results.map(x=>x.post_id));
    const savedIds = new Set(savedRows.results.map(x=>x.post_id));
    const catScore = new Map<string,number>(), typeScore = new Map<string,number>();
    for (const item of [...likedRows.results,...savedRows.results,...historyRows.results]) {
      catScore.set(item.category,(catScore.get(item.category)||0)+1);
      typeScore.set(item.type,(typeScore.get(item.type)||0)+1);
    }
    const now=Date.now();
    const ranked = rows.filter(p=>!blocked.has(p.owner_id)).map(p=>{
      let score=(p.views||0)*0.05+(p.likes||0)*2+(p.comment_count||0)*1.5;
      if(following.has(p.owner_id)) score+=35;
      score+=(catScore.get(p.category||"")||0)*3;
      score+=(typeScore.get(p.type||"")||0)*2;
      if(likedIds.has(p.id)) score-=15;
      if(savedIds.has(p.id)) score-=8;
      if(seen.has(p.id)) score-=6;
      const ageDays=Math.max(0,(now-(p.created_at||now))/86400000);
      score+=Math.max(0,18-ageDays*0.45);
      return {p,score};
    }).sort((a,b)=>b.score-a.score).slice(0,80).map(x=>publicPost(x.p));
    return response({posts:ranked,personalized:true});
  } catch(e) { return failure(e); }
}
