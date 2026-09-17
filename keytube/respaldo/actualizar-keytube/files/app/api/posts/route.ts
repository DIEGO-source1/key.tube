import { z } from 'zod';
import { getAppUser } from '@/lib/auth';
import { db,draftSchema,proofSchema,consumeProof,requireCreator,sameOrigin,readJson,response,failure,hash,AppError,type StoredPost,publicPost,getPost } from '@/lib/keytube-server';
import { verifyRealLock,rpcClient,lockAbi } from '@/lib/unlock';
import { ownerPlans } from '@/lib/plans';
import { validateAssets } from '@/lib/media';
import type { Address } from 'viem';
export const dynamic='force-dynamic';
export async function GET(req:Request) {
  try {
    const query=new URL(req.url).searchParams,id=query.get('id');
    if(id){const post=await getPost(z.string().uuid().parse(id),true);if(post.status==='hidden'&&(await getAppUser())?.userId!==post.owner_id)throw new AppError(404,'Esta publicación no está disponible.');return response({post:publicPost(post)});}
    const view=z.enum(['all','mine','saved','following']).parse(query.get('mine')==='1'?'mine':query.get('view')||'all');
    const order=z.enum(['asc','desc']).parse(query.get('order')||'desc');
    const limit=z.coerce.number().int().min(1).max(50).parse(query.get('limit')||20);
    const creator=z.string().max(120).parse(query.get('creator')||'');
    const search=z.string().trim().max(120).parse(query.get('q')||'');
    const category=z.string().max(35).parse(query.get('category')||'');
    const type=z.enum(['','video','audio','image','document','text']).parse(query.get('type')||'');
    const user=view==='all'?null:await getAppUser();
    if(view!=='all'&&!user)throw new AppError(401,'Inicia sesión para ver tus publicaciones.');
    const conditions:string[]=[],args:(string|number)[]=[];
    if(view!=='mine')conditions.push("p.status='published'");
    if(view==='mine'){conditions.push('p.owner_id=?');args.push(user!.userId);}
    if(view==='saved'){conditions.push('EXISTS (SELECT 1 FROM saved_posts s WHERE s.post_id=p.id AND s.owner_id=?)');args.push(user!.userId);}
    if(view==='following'){conditions.push('EXISTS (SELECT 1 FROM follows f WHERE f.creator_id=p.owner_id AND f.owner_id=?)');args.push(user!.userId);}
    if(creator){conditions.push('p.owner_id=?');args.push(creator);}
    if(query.get('free')==='1')conditions.push("p.visibility='free'");
    if(type){conditions.push('p.type=?');args.push(type);}
    if(category){conditions.push('p.category=?');args.push(category);}
    if(search){conditions.push("instr(lower(p.title || ' ' || COALESCE(pr.name,p.creator) || ' ' || p.category),lower(?))>0");args.push(search);}
    const direction=order==='asc'?'ASC':'DESC',compare=order==='asc'?'>':'<';
    if(query.has('cursor')){
      const cursor=z.string().regex(/^\d{1,16},[a-f0-9-]{36}$/).parse(query.get('cursor'));
      const [time,id]=cursor.split(',');
      const timestamp=z.number().int().nonnegative().safe().parse(Number(time));
      z.string().uuid().parse(id);
      conditions.push(`(p.created_at ${compare} ? OR (p.created_at=? AND p.id ${compare} ?))`);
      args.push(timestamp,timestamp,id);
    }
    // Select public metadata only; originals and private text never enter the feed.
    const fields='id,owner_id,wallet,creator,title,intro,lock,network,created_at,type,category,thumbnail_id,preview_id,visibility,plan_id,premium_lock,status'.split(',').map(f=>'p.'+f).join(',');
    const rows=(await db().prepare(`SELECT ${fields},pr.name AS creator_name,pr.avatar AS creator_avatar FROM posts p LEFT JOIN profiles pr ON pr.owner_id=p.owner_id ${conditions.length?'WHERE '+conditions.join(' AND '):''} ORDER BY p.created_at ${direction},p.id ${direction} LIMIT ?`).bind(...args,limit+1).all<StoredPost>()).results;
    const page=rows.slice(0,limit),last=page.at(-1);
    return response({posts:page.map(publicPost),nextCursor:rows.length>limit&&last?`${last.created_at},${last.id}`:null});
  }catch(e){return failure(e);}
}
export async function POST(req:Request) {
  try {
    sameOrigin(req);const user=await requireCreator();const data=await readJson(req),draft=draftSchema.parse(data.draft);
    let wallet='' as Address,premiumLock:string|null=null;
    if(draft.visibility==='members') {
      const proof=proofSchema.parse(data);
      await consumeProof(req,proof,'publish',await hash(JSON.stringify(draft)),draft.network,user.userId);
      wallet=proof.wallet;
      await verifyRealLock(draft.lock as Address,draft.network);
      const manager=await rpcClient(draft.network).readContract({address:draft.lock as Address,abi:lockAbi,functionName:'isLockManager',args:[wallet]});
      if(!manager)throw new AppError(403,'La wallet conectada debe administrar este Lock.');
      if(draft.planId) {
        const plans=await ownerPlans(user.userId),plan=plans.find(p=>p.id===draft.planId);
        if(!plan||plan.lock!==draft.lock||plan.network!==draft.network||plan.wallet!==wallet)throw new AppError(403,'El plan no pertenece a tu cuenta o a esta wallet.');
        if(!(JSON.parse(plan.coverage) as string[]).includes(draft.type))throw new AppError(400,'Este formato no está incluido en el plan seleccionado.');
        if(plan.slot==='basic')premiumLock=plans.find(p=>p.slot==='premium')?.lock||null;
      }
    } else {draft.lock='';draft.planId=null;}
    await validateAssets(draft,user.userId);
    const id=crypto.randomUUID(),now=Date.now();
    await db().prepare('INSERT INTO posts (id,owner_id,wallet,creator,title,intro,body,lock,network,created_at,type,category,thumbnail_id,preview_id,asset_id,updated_at,visibility,plan_id,premium_lock) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(id,user.userId,wallet,draft.creator,draft.title,draft.intro,draft.body,draft.lock,draft.network,now,draft.type,draft.category,draft.thumbnailId,draft.previewId,draft.assetId,now,draft.visibility,draft.planId,premiumLock).run();
    return response({post:publicPost(await getPost(id))},201);
  }catch(e){return failure(e);}
}
