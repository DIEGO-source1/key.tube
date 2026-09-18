import { db, requireCreator, response, failure } from "@/lib/keytube-server";
import { ensureV10Schema } from "@/lib/v10";
export const dynamic="force-dynamic";
export async function GET(){
  try{
    const user=await requireCreator();await ensureV10Schema();
    const rows=await db().prepare(`SELECT a.post_id,a.creator_id,a.lock_address,a.network,a.verified_at,p.title,p.creator,p.type,p.category
      FROM access_history a JOIN posts p ON p.id=a.post_id WHERE a.owner_id=? ORDER BY a.verified_at DESC LIMIT 80`).bind(user.userId).all();
    return response({accesses:rows.results});
  }catch(e){return failure(e);}
}
