import {z} from 'zod';
import {db,requireCreator,sameOrigin,response,failure,AppError} from '@/lib/keytube-server';
import {bucket,validFile} from '@/lib/media';
import {sessionFor,partBytes,boundedBody} from '@/lib/multipart';
import {UPLOAD_PART_SIZE} from '@/lib/upload-limits';
export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
async function identity(req:Request,context:Context){sameOrigin(req);const user=await requireCreator();return {owner:user.userId,id:z.string().uuid().parse((await context.params).id)};}
export async function PUT(req:Request,context:Context){
  try{
    const {id,owner}=await identity(req,context),s=await sessionFor(id,owner);
    if(s.state!=='uploading')throw new AppError(409,'El archivo se está finalizando.');
    const part=z.coerce.number().int().positive().parse(new URL(req.url).searchParams.get('part'));
    const bytes=await boundedBody(req,partBytes(s.size,part));
    if(part===1&&!validFile(bytes,s.mime))throw new AppError(400,'El contenido del archivo no coincide con su formato.');
    const uploaded=await bucket().resumeMultipartUpload(s.storage_key,s.upload_id).uploadPart(part,bytes);
    await db().prepare('INSERT INTO upload_parts (session_id,part_number,etag,size) VALUES (?,?,?,?) ON CONFLICT(session_id,part_number) DO UPDATE SET etag=excluded.etag,size=excluded.size').bind(id,part,uploaded.etag,bytes.length).run();
    return response({partNumber:part});
  }catch(e){return failure(e);}
}
export async function POST(req:Request,context:Context){
  try{
    const {id,owner}=await identity(req,context);
    const existing=await db().prepare("SELECT id,name,mime,size,role FROM assets WHERE id=? AND owner_id=?").bind(id,owner).first();
    if(existing)return response({asset:existing});
    const s=await sessionFor(id,owner);
    const parts=(await db().prepare('SELECT part_number AS partNumber,etag,size FROM upload_parts WHERE session_id=? ORDER BY part_number').bind(id).all<{partNumber:number;etag:string;size:number}>()).results;
    if(parts.length!==Math.ceil(s.size/UPLOAD_PART_SIZE)||parts.some((p,i)=>p.partNumber!==i+1||p.size!==partBytes(s.size,i+1)))throw new AppError(400,'Faltan partes del archivo. La publicación todavía no se guardó.');
    await db().prepare("UPDATE upload_sessions SET state='completing' WHERE id=?").bind(id).run();
    let object=await bucket().head(s.storage_key);
    if(!object){
      try{object=await bucket().resumeMultipartUpload(s.storage_key,s.upload_id).complete(parts.map(({partNumber,etag})=>({partNumber,etag})));}
      catch(e){await db().prepare("UPDATE upload_sessions SET state='uploading' WHERE id=?").bind(id).run();throw e;}
    }
    if(object.size!==s.size)throw new AppError(400,'El tamaño recibido no coincide con el archivo.');
    await db().batch([
      db().prepare("INSERT OR IGNORE INTO assets (id,owner_id,storage_key,role,name,mime,size,created_at) VALUES (?,?,?,'full',?,?,?,?)").bind(id,owner,s.storage_key,s.name,s.mime,s.size,Date.now()),
      db().prepare('DELETE FROM upload_parts WHERE session_id=?').bind(id),
      db().prepare('DELETE FROM upload_sessions WHERE id=?').bind(id),
    ]);
    return response({asset:{id,role:'full',name:s.name,mime:s.mime,size:s.size}},201);
  }catch(e){return failure(e);}
}
export async function DELETE(req:Request,context:Context){
  try{
    const {id,owner}=await identity(req,context),s=await sessionFor(id,owner);
    if(s.state!=='uploading')throw new AppError(409,'Espera a que termine de guardarse el archivo.');
    await bucket().resumeMultipartUpload(s.storage_key,s.upload_id).abort();
    await db().batch([db().prepare('DELETE FROM upload_parts WHERE session_id=?').bind(id),db().prepare('DELETE FROM upload_sessions WHERE id=?').bind(id)]);
    return response({cancelled:true});
  }catch(e){return failure(e);}
}
