"use client";
import {useState,type FormEvent} from 'react';
import {Eye,EyeOff,LoaderCircle,Save} from 'lucide-react';
import {Modal} from './keytube-forms';
import {api,errorText} from '@/lib/keytube-client';
import type {PublicPost,CreatorPlan} from '@/lib/keytube-types';
export function PostSettings({post,plans,onClose,onSaved}:{post:PublicPost;plans:CreatorPlan[];onClose:()=>void;onSaved:(post:PublicPost)=>Promise<void>}){
  const [status,setStatus]=useState(post.status||'published'),[access,setAccess]=useState(post.visibility==='free'?'free':post.plan_id||'keep'),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function save(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{const result=await api<{post:PublicPost}>('/api/studio?post='+post.id,{status,access},'PATCH');await onSaved(result.post);}catch(e){setError(errorText(e));}finally{setBusy(false);}}
  return <Modal title="Acceso de la publicación" onClose={()=>{if(!busy)onClose();}}><h2>Acceso de la publicación</h2><p>{post.title}</p><form className="k2-form" onSubmit={save}><fieldset disabled={busy}>
    <label>Visibilidad<select value={status} onChange={e=>setStatus(e.target.value as 'published'|'hidden')}><option value="published">Publicada · aparece en el muro</option><option value="hidden">Oculta · solo yo puedo verla</option></select></label>
    <p className="k2-notice">{status==='hidden'?<><EyeOff size={17}/>Quedará en «Mi contenido». Visitantes y miembros no podrán abrirla hasta que vuelvas a publicarla.</>:<><Eye size={17}/>Se verá en el muro con el acceso que elijas a continuación.</>}</p>
    <label>¿Quién puede abrir el contenido completo?<select value={access} onChange={e=>setAccess(e.target.value)}><option value="free">Todos · gratis</option>{post.visibility==='members'&&!plans.some(p=>p.id===post.plan_id)&&<option value="keep">Mantener membresía actual</option>}{plans.filter(p=>p.coverage.includes(post.type||'text')).map(p=><option key={p.id} value={p.id}>{p.name}{p.slot==='basic'?' · también Premium':' · solo Premium'}</option>)}</select></label>
    {!plans.length&&<p className="k2-small">Puedes ocultarla ahora. Para restringirla a una membresía, crea tus planes en «Mis planes».</p>}
    {access!=='free'&&post.visibility==='free'&&!post.preview_url&&<p className="k2-notice">Se conservarán la portada y la introducción como muestra. El archivo completo requerirá membresía.</p>}
    {error&&<p className="k2-error" role="alert">{error}</p>}<div className="k2-row"><button className="k2-primary" disabled={busy}>{busy?<LoaderCircle className="k2-spin" size={17}/>:<Save size={17}/>}Guardar cambios</button><button type="button" className="k2-secondary" disabled={busy} onClick={onClose}>Cancelar</button></div>
  </fieldset></form></Modal>;
}
