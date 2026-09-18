import { db, requireCreator, response, failure } from "@/lib/keytube-server";
import { ensureV10Schema } from "@/lib/v10";

export const dynamic = "force-dynamic";

type TimeRow = { created_at: number };

export async function GET(req: Request){
  try{
    const user=await requireCreator();await ensureV10Schema();
    const rawPeriod=Number(new URL(req.url).searchParams.get("period")||30);
    const period=[7,30,90].includes(rawPeriod)?rawPeriod:30;
    const since=Date.now()-period*86400000;
    const [summary,top,followers,accesses,comments,likes,likeTimes,commentTimes,followTimes,accessTimes] = await Promise.all([
      db().prepare(`SELECT COUNT(*) AS posts,COALESCE(SUM(views),0) AS views FROM posts WHERE owner_id=?`).bind(user.userId).first<{posts:number;views:number}>(),
      db().prepare(`SELECT p.id,p.title,p.views,p.type,p.category,
        (SELECT COUNT(*) FROM post_likes l WHERE l.post_id=p.id) AS likes,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id) AS comments
        FROM posts p WHERE p.owner_id=? ORDER BY p.views DESC,p.created_at DESC LIMIT 10`).bind(user.userId).all(),
      db().prepare("SELECT COUNT(*) AS n FROM follows WHERE creator_id=?").bind(user.userId).first<{n:number}>(),
      db().prepare("SELECT COUNT(*) AS n FROM access_history WHERE creator_id=?").bind(user.userId).first<{n:number}>(),
      db().prepare("SELECT COUNT(*) AS n FROM comments c JOIN posts p ON p.id=c.post_id WHERE p.owner_id=?").bind(user.userId).first<{n:number}>(),
      db().prepare("SELECT COUNT(*) AS n FROM post_likes l JOIN posts p ON p.id=l.post_id WHERE p.owner_id=?").bind(user.userId).first<{n:number}>(),
      db().prepare("SELECT l.created_at FROM post_likes l JOIN posts p ON p.id=l.post_id WHERE p.owner_id=? AND l.created_at>=? ORDER BY l.created_at DESC LIMIT 5000").bind(user.userId,since).all<TimeRow>(),
      db().prepare("SELECT c.created_at FROM comments c JOIN posts p ON p.id=c.post_id WHERE p.owner_id=? AND c.created_at>=? ORDER BY c.created_at DESC LIMIT 5000").bind(user.userId,since).all<TimeRow>(),
      db().prepare("SELECT created_at FROM follows WHERE creator_id=? AND created_at>=? ORDER BY created_at DESC LIMIT 5000").bind(user.userId,since).all<TimeRow>(),
      db().prepare("SELECT verified_at AS created_at FROM access_history WHERE creator_id=? AND verified_at>=? ORDER BY verified_at DESC LIMIT 5000").bind(user.userId,since).all<TimeRow>(),
    ]);

    const keys:string[]=[];
    const buckets=new Map<string,{date:string;likes:number;comments:number;followers:number;accesses:number;total:number}>();
    for(let i=period-1;i>=0;i--){
      const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-i);
      const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      keys.push(key);buckets.set(key,{date:key,likes:0,comments:0,followers:0,accesses:0,total:0});
    }
    const add=(rows:TimeRow[],field:"likes"|"comments"|"followers"|"accesses")=>{
      for(const row of rows){
        const d=new Date(Number(row.created_at));
        const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
        const bucket=buckets.get(key);if(bucket){bucket[field]++;bucket.total++;}
      }
    };
    add(likeTimes.results,"likes");add(commentTimes.results,"comments");add(followTimes.results,"followers");add(accessTimes.results,"accesses");
    const series=keys.map(k=>buckets.get(k)!);
    return response({summary:{posts:summary?.posts||0,views:summary?.views||0,followers:followers?.n||0,accesses:accesses?.n||0,comments:comments?.n||0,likes:likes?.n||0},top:top.results,series,period});
  }catch(e){return failure(e);}
}
