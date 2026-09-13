import { z } from 'zod';
import { AppError,addressSchema,networkSchema,db,type StoredPost } from './keytube-server';
import { rpcClient,lockAbi,getMembership } from './unlock';
import type { Address } from 'viem';
export const planSchema=z.object({
  slot:z.enum(['basic','premium']), name:z.string().trim().min(2).max(65),
  description:z.string().trim().max(600), benefits:z.array(z.string().trim().min(1).max(120)).max(8),
  coverage:z.array(z.enum(['video','audio','image','document','text'])).min(1).max(5),
  price:z.string().regex(/^\d+(\.\d{1,18})?$/),durationDays:z.number().int().min(1).max(365),
  network:networkSchema,lock:addressSchema,
});
export type PlanInput=z.infer<typeof planSchema>;
export type PlanRow={id:string;owner_id:string;slot:'basic'|'premium';name:string;description:string;benefits:string;coverage:string;price:string;duration_days:number;network:number;lock:Address;wallet:Address;updated_at:number};
export async function ownerPlans(owner:string) {
  return (await db().prepare('SELECT * FROM creator_plans WHERE owner_id=? ORDER BY slot').bind(owner).all<PlanRow>()).results;
}
export function serializePlan(p:PlanRow) {
  return {id:p.id,ownerId:p.owner_id,slot:p.slot,name:p.name,description:p.description,benefits:JSON.parse(p.benefits) as string[],coverage:JSON.parse(p.coverage) as string[],price:p.price,durationDays:p.duration_days,network:p.network,lock:p.lock,wallet:p.wallet};
}
export async function hasPostMembership(post:StoredPost,wallet:Address) {
  const locks=[post.lock,...(post.premium_lock?[post.premium_lock as Address]:[])];
  // A valid Key for either explicitly accepted Lock grants access. RPC errors
  // never become access; they are reported if no successfully checked Key exists.
  const results=await Promise.allSettled(locks.map(lock=>rpcClient(post.network).readContract({address:lock,abi:lockAbi,functionName:'getHasValidKey',args:[wallet]})));
  if(results.some(r=>r.status==='fulfilled'&&r.value===true))return true;
  const error=results.find(r=>r.status==='rejected');
  if(error?.status==='rejected')throw error.reason;
  return false;
}
