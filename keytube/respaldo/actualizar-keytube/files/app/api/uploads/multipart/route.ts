import {z} from 'zod';
import {db,requireCreator,sameOrigin,readJson,response,failure,AppError} from '@/lib/keytube-server';
import {bucket} from '@/lib/media';
import {MAX_FILE_SIZE,UPLOAD_PART_SIZE,STUDIO_CAPACITY,UPLOAD_MIMES} from '@/lib/upload-limits';
import {cleanExpired} from '@/lib/multipart';
export const dynamic='force-dynamic';
export async function POST(req:Request){
  try{
    sameOrigin(req);const user=await requireCreator();
    const data=z.object({name:z.string().trim().min(1).max(150),mime:z.enum(UPLOAD_MIMES),size:z.number().int().min(1).max(MAX_FILE_SIZE,'El límite por archivo completo es 500 MB.')}).parse(await readJson(req));
    await cleanExpired(user.userId);
    const id=crypto.randomUUID(),key='full/'+id,now=Date.now();
    const pending=await bucket().createMultipartUpload(key,{httpMetadata:{contentType:data.mime}});
    try{
      const reserved=await db().prepare(`INSERT INTO upload_sessions (id,owner_id,storage_key,upload_id,name,mime,size,expires_at)
        SELECT ?,?,?,?,?,?,?,? WHERE
        COALESCE((SELECT SUM(size) FROM assets WHERE owner_id=?),0)+
        COALESCE((SELECT SUM(size) FROM upload_sessions WHERE owner_id=?),0)+? <= ?
        AND (SELECT COUNT(*) FROM upload_sessions WHERE owner_id=?)<10 RETURNING id`)
        .bind(id,user.userId,key,pending.uploadId,data.name.replace(/[\r\n\x00-\x1f]/g,''),data.mime,data.size,now+86400000,user.userId,user.userId,data.size,STUDIO_CAPACITY,user.userId).first();
      if(!reserved)throw new AppError(413,'No hay espacio suficiente (5 GB por estudio) o hay demasiadas cargas pendientes. Cancela una carga e inténtalo de nuevo.');
    }catch(e){await pending.abort();throw e;}
    return response({id,partSize:UPLOAD_PART_SIZE},201);
  }catch(e){return failure(e);}
}
