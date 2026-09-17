import {api,ApiError} from './keytube-client';
import type {Asset} from './keytube-types';
import {MAX_FILE_SIZE,SMALL_FILE_SIZE,UPLOAD_PART_SIZE} from './upload-limits';
const mimeByExt:Record<string,string>={mp4:'video/mp4',webm:'video/webm',mp3:'audio/mpeg',wav:'audio/wav',ogg:'audio/ogg',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',pdf:'application/pdf',txt:'text/plain'};
function send(path:string,body:Blob,method:string,headers:Record<string,string>,signal:AbortSignal,progress:(sent:number)=>void){
  return new Promise<{asset?:Asset}>((resolve,reject)=>{
    if(signal.aborted){reject(new Error('Carga cancelada.'));return;}
    const xhr=new XMLHttpRequest();xhr.open(method,path);xhr.timeout=180000;
    for(const [name,value] of Object.entries(headers))xhr.setRequestHeader(name,value);
    const abort=()=>xhr.abort();signal.addEventListener('abort',abort,{once:true});
    xhr.upload.onprogress=e=>progress(e.loaded);
    xhr.onload=()=>{let data;try{data=JSON.parse(xhr.responseText);}catch{reject(new ApiError('El servidor no pudo recibir el archivo. Vuelve a intentarlo.',undefined,xhr.status));return;}if(xhr.status>=200&&xhr.status<300)resolve(data);else reject(new ApiError(data.error||'No se pudo subir el archivo.',data.code,xhr.status));};
    xhr.onerror=()=>reject(new ApiError('Se interrumpió la conexión durante la carga.',undefined,0));
    xhr.ontimeout=()=>reject(new ApiError('La carga tardó demasiado. Comprueba tu conexión.',undefined,408));
    xhr.onabort=()=>reject(new Error('Carga cancelada.'));
    xhr.onloadend=()=>signal.removeEventListener('abort',abort);
    xhr.send(body);
  });
}
export async function uploadFile(file:File,role:string,onProgress:(percent:number)=>void=()=>{},signal=new AbortController().signal){
  const mime=file.type.split(';')[0]||mimeByExt[file.name.split('.').pop()?.toLowerCase()||''];
  const max=role==='full'?MAX_FILE_SIZE:SMALL_FILE_SIZE;
  if(!file.size||file.size>max)throw new Error(role==='full'?'El archivo completo debe pesar entre 1 byte y 500 MB.':'La portada o el adelanto debe pesar como máximo 20 MB.');
  if(role!=='full'||file.size<=UPLOAD_PART_SIZE){
    const result=await send('/api/uploads?role='+role,file,'POST',{'Content-Type':mime,'X-File-Name':encodeURIComponent(file.name)},signal,n=>onProgress(Math.min(100,n/file.size*100)));
    if(!result.asset)throw new Error('No se recibió la confirmación del archivo.');return result.asset.id;
  }
  const session=await api<{id:string;partSize:number}>('/api/uploads/multipart',{name:file.name.slice(0,150),mime,size:file.size});
  const path='/api/uploads/multipart/'+session.id;
  let finishing=false;
  try{
    for(let offset=0,part=1;offset<file.size;offset+=session.partSize,part++){
      const chunk=file.slice(offset,offset+session.partSize);
      for(let attempt=0;;attempt++){
        try{await send(path+'?part='+part,chunk,'PUT',{'Content-Type':'application/octet-stream'},signal,n=>onProgress(Math.min(99,(offset+n)/file.size*100)));break;}
        catch(e){if(signal.aborted||attempt>=2||!(e instanceof ApiError)||![0,408,429,500,502,503,504].includes(e.status||0))throw e;await new Promise(r=>setTimeout(r,700*(attempt+1)));}
      }
    }
    if(signal.aborted)throw new Error('Carga cancelada.');
    finishing=true;
    let result:{asset:Asset}|undefined;
    for(let attempt=0;;attempt++){
      try{result=await api<{asset:Asset}>(path,{},'POST');break;}
      catch(e){if(attempt>=2)throw e;await new Promise(r=>setTimeout(r,700));}
    }
    onProgress(100);return result!.asset.id;
  }catch(e){if(!finishing)await api(path,undefined,'DELETE').catch(()=>{});throw e;}
}
