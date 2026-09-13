import {db,AppError} from './keytube-server';
import {bucket} from './media';
import {UPLOAD_PART_SIZE} from './upload-limits';
export type UploadSession={id:string;owner_id:string;storage_key:string;upload_id:string;name:string;mime:string;size:number;state:string;expires_at:number};
export async function sessionFor(id:string,owner:string){
  const session=await db().prepare('SELECT * FROM upload_sessions WHERE id=? AND owner_id=?').bind(id,owner).first<UploadSession>();
  if(!session)throw new AppError(404,'Esta carga no existe o pertenece a otra cuenta.');
  if(session.expires_at<Date.now())throw new AppError(410,'La carga venció. Selecciona de nuevo el archivo para subirlo.');
  return session;
}
export function partBytes(size:number,part:number){
  if(!Number.isInteger(part)||part<1||part>Math.ceil(size/UPLOAD_PART_SIZE))throw new AppError(400,'Parte del archivo inválida.');
  return Math.min(UPLOAD_PART_SIZE,size-(part-1)*UPLOAD_PART_SIZE);
}
export async function boundedBody(req:Request,limit:number){
  if(Number(req.headers.get('content-length')||0)>limit)throw new AppError(413,'La parte supera el tamaño permitido.');
  const reader=req.body?.getReader();if(!reader)throw new AppError(400,'El archivo está vacío.');
  const result=new Uint8Array(limit);let offset=0;
  while(true){const {done,value}=await reader.read();if(done)break;if(offset+value.length>limit){await reader.cancel();throw new AppError(413,'La parte supera el tamaño permitido.');}result.set(value,offset);offset+=value.length;}
  if(offset!==limit)throw new AppError(400,'La parte llegó incompleta. Vuelve a intentarlo.');
  return result;
}
export async function cleanExpired(owner:string){
  const expired=(await db().prepare('SELECT * FROM upload_sessions WHERE owner_id=? AND expires_at<? LIMIT 10').bind(owner,Date.now()).all<UploadSession>()).results;
  for(const s of expired){
    try{await bucket().resumeMultipartUpload(s.storage_key,s.upload_id).abort();await bucket().delete(s.storage_key);}
    catch{continue;}
    await db().batch([db().prepare('DELETE FROM upload_parts WHERE session_id=?').bind(s.id),db().prepare('DELETE FROM upload_sessions WHERE id=?').bind(s.id)]);
  }
}
