import { parseEther } from 'viem';
import { z } from 'zod';
import { db,requireCreator,proofSchema,consumeProof,hash,sameOrigin,readJson,response,failure,AppError } from '@/lib/keytube-server';
import { getAppUser } from '@/lib/auth';
import { planSchema,ownerPlans,serializePlan } from '@/lib/plans';
import { verifyRealLock,rpcClient,lockAbi,getMembership } from '@/lib/unlock';
export const dynamic='force-dynamic';
export async function GET(req:Request) {
  try {
    const owner=new URL(req.url).searchParams.get('creator')||(await getAppUser())?.userId;
    if(!owner)return response({plans:[]});
    const plans=await ownerPlans(owner);
    const quoted=await Promise.all(plans.map(async p=>{
      try{return {...serializePlan(p),quote:await getMembership(p.lock,p.network)};}
      catch{return {...serializePlan(p),quote:null};}
    }));
    return response({plans:quoted});
  }catch(e){return failure(e);}
}
export async function POST(req:Request) {
  try {
    sameOrigin(req);const user=await requireCreator();
    const {plan,...proof}=proofSchema.extend({plan:planSchema}).parse(await readJson(req));
    await consumeProof(req,proof,'plan',await hash(JSON.stringify(plan)),plan.network,user.userId);
    const linked=await db().prepare('SELECT wallet FROM profiles WHERE owner_id=?').bind(user.userId).first<{wallet:string}>();
    if(linked?.wallet&&linked.wallet.toLowerCase()!==proof.wallet.toLowerCase())throw new AppError(403,'Conecta la wallet que vinculaste a tu perfil o cámbiala desde Mi cuenta.');
    await verifyRealLock(plan.lock,plan.network);
    const client=rpcClient(plan.network);
    const [manager,price,duration,currency]=await Promise.all([
      client.readContract({address:plan.lock,abi:lockAbi,functionName:'isLockManager',args:[proof.wallet]}),
      client.readContract({address:plan.lock,abi:lockAbi,functionName:'keyPrice'}),
      client.readContract({address:plan.lock,abi:lockAbi,functionName:'expirationDuration'}),
      client.readContract({address:plan.lock,abi:lockAbi,functionName:'tokenAddress'}),
    ]);
    if(!manager)throw new AppError(403,'Tu wallet debe administrar el Lock de este plan.');
    if(currency!=='0x0000000000000000000000000000000000000000')throw new AppError(400,'Crea este plan con la moneda nativa de la red (ETH o POL).');
    if(price!==parseEther(plan.price)||duration!==BigInt(plan.durationDays*86400))throw new AppError(409,'El precio o la duración no coinciden con el Lock. Actualiza el contrato o corrige estos campos.');
    const existing=await ownerPlans(user.userId);
    const old=existing.find(p=>p.slot===plan.slot),other=existing.find(p=>p.slot!==plan.slot);
    if(other&&(other.network!==plan.network||other.wallet!==proof.wallet))throw new AppError(400,'Los dos planes deben usar la misma red y la misma wallet administradora.');
    if(other?.lock===plan.lock)throw new AppError(400,'Cada plan necesita su propio Lock.');
    if(other) {
      const basic=plan.slot==='basic'?plan.coverage:JSON.parse(other.coverage) as string[];
      const premium=plan.slot==='premium'?plan.coverage:JSON.parse(other.coverage) as string[];
      if(basic.some(x=>!premium.includes(x as never)))throw new AppError(400,'Premium debe incluir los formatos cubiertos por el plan Básico.');
    }
    if(old&&(old.lock!==plan.lock||old.network!==plan.network))throw new AppError(409,'Conserva el Lock de este plan para respetar las membresías que ya se compraron.');
    const used=await db().prepare('SELECT type FROM posts WHERE owner_id=? AND plan_id=?').bind(user.userId,old?.id||'').all<{type:string}>();
    if(used.results.some(p=>!plan.coverage.includes(p.type as typeof plan.coverage[number])))throw new AppError(409,'Este plan ya tiene publicaciones de un formato que intentas quitar. Conserva ese formato o elimina esas publicaciones primero.');
    const duplicate=await db().prepare('SELECT id FROM creator_plans WHERE lock=? AND network=? AND owner_id<>?').bind(plan.lock,plan.network,user.userId).first();
    if(duplicate)throw new AppError(409,'Ese Lock ya está asociado con otro creador.');
    const id=old?.id||crypto.randomUUID();
    await db().prepare('INSERT INTO creator_plans (id,owner_id,slot,name,description,benefits,coverage,price,duration_days,network,lock,wallet,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(owner_id,slot) DO UPDATE SET name=excluded.name,description=excluded.description,benefits=excluded.benefits,coverage=excluded.coverage,price=excluded.price,duration_days=excluded.duration_days,updated_at=excluded.updated_at')
      .bind(id,user.userId,plan.slot,plan.name,plan.description,JSON.stringify(plan.benefits),JSON.stringify(plan.coverage),plan.price,plan.durationDays,plan.network,plan.lock,proof.wallet,Date.now()).run();
    if(plan.slot==='premium'&&other)await db().prepare("UPDATE posts SET premium_lock=? WHERE owner_id=? AND plan_id=? AND visibility='members'").bind(plan.lock,user.userId,other.id).run();
    if(!linked?.wallet)await db().prepare('UPDATE profiles SET wallet=?,updated_at=? WHERE owner_id=?').bind(proof.wallet,Date.now(),user.userId).run();
    return response({plan:{...plan,id,ownerId:user.userId,wallet:proof.wallet}});
  }catch(e){return failure(e);}
}
