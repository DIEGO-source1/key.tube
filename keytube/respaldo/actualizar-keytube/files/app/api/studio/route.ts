import { z } from "zod";
import {
  db,
  requireCreator,
  getPost,
  sameOrigin,
  response,
  failure,
  AppError,
  readJson,
  publicPost,
} from "@/lib/keytube-server";
import { getAsset, bucket } from "@/lib/media";
import {ownerPlans} from '@/lib/plans';
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const user = await requireCreator();
    const post = await getPost(
      z.string().uuid().parse(new URL(req.url).searchParams.get("post")),
      true,
    );
    if (post.owner_id !== user.userId)
      throw new AppError(403, "Esta publicación pertenece a otro creador.");
    const asset = post.asset_id ? await getAsset(post.asset_id) : null;
    return response({
      body: post.body,
      mediaUrl: asset ? `/api/media/${asset.id}?owner=1` : undefined,
      mime: asset?.mime,
      verifiedAt: Date.now(),
      creatorPreview: true,
    });
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(req: Request) {
  try {
    sameOrigin(req);
    const user = await requireCreator();
    const post = await getPost(
      z.string().uuid().parse(new URL(req.url).searchParams.get("post")),
      true,
    );
    if (post.owner_id !== user.userId)
      throw new AppError(403, "Esta publicación pertenece a otro creador.");
    await db().batch([
      db().prepare("DELETE FROM media_grants WHERE post_id = ?").bind(post.id),
      db().prepare("DELETE FROM saved_posts WHERE post_id = ?").bind(post.id),
      db().prepare("DELETE FROM comments WHERE post_id = ?").bind(post.id),
      db()
        .prepare("DELETE FROM posts WHERE id = ? AND owner_id = ?")
        .bind(post.id, user.userId),
    ]);
    // Remove only assets that no other publication uses.
    for(const id of new Set([post.asset_id,post.preview_id,post.thumbnail_id].filter((x):x is string=>!!x))){
      const unused=await db().prepare(`DELETE FROM assets WHERE id=? AND owner_id=?
        AND NOT EXISTS (SELECT 1 FROM posts WHERE asset_id=? OR preview_id=? OR thumbnail_id=?)
        AND NOT EXISTS (SELECT 1 FROM profiles WHERE avatar=?) RETURNING storage_key`).bind(id,user.userId,id,id,id,id).first<{storage_key:string}>();
      if(unused)await bucket().delete(unused.storage_key).catch(e=>console.error('Unable to remove unused media',e instanceof Error?e.message:'storage error'));
    }
    return response({ deleted: true });
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(req:Request){
  try{
    sameOrigin(req);const user=await requireCreator();
    const id=z.string().uuid().parse(new URL(req.url).searchParams.get('post'));
    const post=await getPost(id,true);
    if(post.owner_id!==user.userId)throw new AppError(403,'Solo el autor puede cambiar esta publicación.');
    const data=z.object({status:z.enum(['published','hidden']),access:z.string().min(1).max(40)}).parse(await readJson(req));
    let visibility=post.visibility||'members',planId=post.plan_id||null,lock:string=post.lock,network=post.network,wallet:string=post.wallet,premiumLock=post.premium_lock||null;
    if(data.access==='free'){visibility='free';planId=null;lock='';premiumLock=null;}
    else if(data.access!=='keep'){
      z.string().uuid().parse(data.access);
      const plans=await ownerPlans(user.userId),plan=plans.find(p=>p.id===data.access);
      if(!plan)throw new AppError(403,'El plan debe pertenecer a tu cuenta.');
      if(!(JSON.parse(plan.coverage) as string[]).includes(post.type||'text'))throw new AppError(400,'Este plan no incluye el formato de la publicación.');
      visibility='members';planId=plan.id;lock=plan.lock;network=plan.network;wallet=plan.wallet;
      premiumLock=plan.slot==='basic'?plans.find(p=>p.slot==='premium'&&p.network===network)?.lock||null:null;
    }
    await db().batch([
      db().prepare('UPDATE posts SET status=?,visibility=?,plan_id=?,lock=?,network=?,wallet=?,premium_lock=?,updated_at=? WHERE id=? AND owner_id=?').bind(data.status,visibility,planId,lock,network,wallet,premiumLock,Date.now(),id,user.userId),
      db().prepare('DELETE FROM media_grants WHERE post_id=?').bind(id),
    ]);
    return response({post:publicPost(await getPost(id,true))});
  }catch(e){return failure(e);}
}
