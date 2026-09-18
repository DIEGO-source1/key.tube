import { z } from 'zod';
import { getPost,response,failure,AppError } from '@/lib/keytube-server';
import { getAsset } from '@/lib/media';
import { ensureV10Schema } from "@/lib/v10";
export const dynamic='force-dynamic';
export async function GET(req:Request) {
  try {
    await ensureV10Schema();
    const post=await getPost(z.string().uuid().parse(new URL(req.url).searchParams.get('post')));
    if(post.visibility!=='free')throw new AppError(403,'Esta publicación requiere una membresía.');
    const asset=post.asset_id?await getAsset(post.asset_id):null;
    return response({body:post.body,mediaUrl:asset?`/api/media/${asset.id}?public=${post.id}`:undefined,mime:asset?.mime,verifiedAt:Date.now()});
  }catch(e){return failure(e);}
}
