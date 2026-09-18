"use client";
import {useState,useRef,useEffect,type ReactNode,type FormEvent} from 'react';
import {X,Upload,Check,KeyRound,Mail,ShieldCheck,ArrowRight,LoaderCircle} from 'lucide-react';
import {Brand} from './keytube-content';
import {api,connectWallet,signProof,errorText,mediaLabels} from '@/lib/keytube-client';
import {deployPlanLock,updatePlanLock} from '@/lib/lock-client';
import {uploadFile} from '@/lib/upload-client';
import {MAX_FILE_SIZE} from '@/lib/upload-limits';
import {videoPreview,audioPreview,imagePreview} from '@/lib/preview-client';
import {NETWORK_OPTIONS,CATEGORIES,type CreatorPlan,type ContentType,type Asset,type Draft,type PublicPost} from '@/lib/keytube-types';
import {parseLockReference} from '@/lib/lock-reference';
export function Modal({title,onClose,children,wide=false}:{title:string;onClose:()=>void;children:ReactNode;wide?:boolean}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{ref.current?.showModal();const old=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=old;};},[]);
  return <dialog ref={ref} className={`k2-modal ${wide?'wide':''}`} aria-label={title} onCancel={onClose} onClick={e=>{if(e.target===ref.current)onClose();}}><div className="k2-modal-body"><button className="k2-icon k2-close" onClick={onClose} aria-label="Cerrar"><X size={20}/></button>{children}</div></dialog>;
}
export function AuthForm({googleEnabled,onSuccess}:{googleEnabled:boolean;onSuccess:()=>void}) {
  const [mode,setMode]=useState<'login'|'register'>('login'),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const data=new FormData(e.currentTarget);setBusy(true);setError('');try{await api(`/api/auth/${mode}`,{name:data.get('name')||undefined,email:data.get('email'),password:data.get('password')});onSuccess();}catch(e){setError(errorText(e));}finally{setBusy(false);}}
  return <div className="k2-auth"><Brand large/><span className="k2-eyebrow">TU COMUNIDAD EMPIEZA AQUÍ</span><h1>{mode==='login'?'Bienvenido de nuevo':'Crea tu cuenta'}</h1><p>Descubre contenido, apoya a tus creadores o abre tu propio estudio.</p><div className="k2-tabs"><button className={mode==='login'?'active':''} onClick={()=>{setMode('login');setError('');}}>Iniciar sesión</button><button className={mode==='register'?'active':''} onClick={()=>{setMode('register');setError('');}}>Registrarme</button></div><form onSubmit={submit} className="k2-form">
    {mode==='register'&&<label>Tu nombre<input name="name" required minLength={2} maxLength={65} autoComplete="name" placeholder="Cómo te verá tu comunidad"/></label>}
    <label>Correo electrónico<input type="email" name="email" required maxLength={254} autoComplete="email" placeholder="tu@correo.com"/></label>
    <label>Contraseña<input type="password" name="password" required minLength={10} maxLength={128} autoComplete={mode==='register'?'new-password':'current-password'} placeholder="Mínimo 10 caracteres"/></label>
    {error&&<p className="k2-error" role="alert">{error}</p>}<button className="k2-primary" disabled={busy}>{busy?<LoaderCircle className="k2-spin" size={18}/>:<Mail size={18}/>} {busy?'Un momento…':mode==='login'?'Iniciar sesión':'Crear mi cuenta'}<ArrowRight size={17}/></button>
  </form><div className="k2-or">o continúa con</div><a className={`k2-google ${!googleEnabled?'disabled':''}`} aria-disabled={!googleEnabled} href={googleEnabled?'/api/auth/google/start':undefined}><span className="k2-google-g">G</span> Continuar con Google</a>{!googleEnabled&&<small>Google estará disponible cuando el administrador conecte el proyecto con Google.</small>}<p className="k2-small"><ShieldCheck size={15}/> Una cuenta para descubrir y crear.</p></div>;
}
const formats:ContentType[]=['video','audio','image','document','text'];
export function PlanEditor({slot,existing,sibling,onSaved}:{slot:'basic'|'premium';existing?:CreatorPlan;sibling?:CreatorPlan;onSaved:()=>void}) {
  const [name,setName]=useState(existing?.name||(slot==='basic'?'Básico':'Premium')),[description,setDescription]=useState(existing?.description||''),[benefits,setBenefits]=useState(existing?.benefits.join('\n')||''),[coverage,setCoverage]=useState<ContentType[]>(existing?.coverage||formats),[price,setPrice]=useState(existing?.price||''),[days,setDays]=useState(existing?.durationDays||30),[network,setNetwork]=useState(existing?.network||sibling?.network||11155111),[lock,setLock]=useState(existing?.lock||''),[importing,setImporting]=useState(!!existing),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState('');
  function changeLock(value:string){
    setError('');setStatus('');
    const reference=parseLockReference(value);
    if(!reference){setLock(value);return;}
    const fixedNetwork=existing?.network||sibling?.network;
    if(fixedNetwork&&fixedNetwork!==reference.network){setError('Este Lock está en otra red. Los dos planes deben usar la misma red.');return;}
    setLock(reference.lock);setNetwork(reference.network);
    setStatus(`Red seleccionada desde tu enlace: ${NETWORK_OPTIONS.find(n=>n.id===reference.network)!.name}.`);
  }
  async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{
    if(!coverage.length)throw new Error('Selecciona al menos un formato.');
    if(sibling){const basic=slot==='basic'?coverage:sibling.coverage,premium=slot==='premium'?coverage:sibling.coverage;if(basic.some(t=>!premium.includes(t)))throw new Error('Premium debe cubrir también los formatos del Básico.');}
    const wallet=await connectWallet();if(sibling&&sibling.wallet.toLowerCase()!==wallet.toLowerCase())throw new Error('Conecta la misma wallet que administra tu otro plan.');
    let address=lock.trim();const base={name,price,durationDays:days,network};
    if(!address&&!importing){address=await deployPlanLock(base,wallet,setStatus);setLock(address);setImporting(true);}
    else if(existing)await updatePlanLock({...base,lock:address},wallet,setStatus);
    if(!/^0x[0-9a-fA-F]{40}$/.test(address))throw new Error('Escribe la dirección del Lock o crea uno nuevo.');
    const plan={slot,name,description,benefits:benefits.split('\n').map(x=>x.trim()).filter(Boolean),coverage,price,durationDays:days,network,lock:address};
    setStatus('Firma para vincular este plan con tu cuenta de KeyTube.');
    const proof=await signProof('plan',wallet,network,{plan});
    setStatus(`Verificando tu Lock en ${NETWORK_OPTIONS.find(n=>n.id===network)?.name||'la red seleccionada'}…`);
    await api('/api/plans',{plan,...proof});setStatus('Plan guardado y conectado con Unlock.');onSaved();
  }catch(e){setError(errorText(e));setStatus('');}finally{setBusy(false);}}
  return <form className={`k2-plan-editor k2-form ${slot==='premium'?'premium':''}`} onSubmit={submit}><div className="k2-row"><span className="k2-plan-icon"><KeyRound/></span><div><span className="k2-eyebrow">{slot==='basic'?'PRIMER NIVEL':'EXPERIENCIA COMPLETA'}</span><h2>{slot==='basic'?'Plan Básico':'Plan Premium'}</h2></div>{existing&&<span className="k2-badge free"><Check size={12}/> Activo</span>}</div><p>{slot==='basic'?'La puerta de entrada a tu contenido exclusivo.':'Contenido Premium y todo lo incluido en Básico.'}</p><fieldset disabled={busy}>
    <label>Nombre del plan<input required minLength={2} maxLength={65} value={name} onChange={e=>setName(e.target.value)}/></label><label>Descripción<textarea maxLength={600} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Cuenta por qué vale la pena ser miembro"/></label>
    <div className="k2-columns"><label>Precio en {network===137?'POL':'ETH'}<input required inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,18})?" value={price} onChange={e=>setPrice(e.target.value)} placeholder="Ej. 0.001"/></label><label>Duración en días<input required type="number" min={1} max={365} value={days} onChange={e=>setDays(Number(e.target.value))}/></label></div>
    <label>Beneficios · uno por línea<textarea rows={3} value={benefits} onChange={e=>setBenefits(e.target.value)} placeholder={'Videos completos\nSesiones y material exclusivo'} /></label><span className="k2-label">¿Qué formatos cubre?</span><div className="k2-checks">{formats.map(t=><label key={t}><input type="checkbox" checked={coverage.includes(t)} onChange={e=>setCoverage(e.target.checked?[...coverage,t]:coverage.filter(x=>x!==t))}/>{mediaLabels[t]}</label>)}</div>
    <label>Red del plan<select value={network} disabled={!!existing||!!sibling} onChange={e=>{setNetwork(Number(e.target.value));setError('');setStatus('');}}>{NETWORK_OPTIONS.map(n=><option key={n.id} value={n.id}>{n.name}</option>)}</select></label>
    {!existing&&<label className="k2-checkbox"><input type="checkbox" checked={importing} onChange={e=>setImporting(e.target.checked)}/> Ya tengo un Lock y quiero vincularlo</label>}
    {(importing||!!lock)&&<label>Dirección o enlace del Lock<input required readOnly={!!existing} value={lock} onChange={e=>changeLock(e.target.value)} placeholder="Pega la dirección 0x… o el enlace de Unlock" pattern="0x[0-9a-fA-F]{40}"/>{!existing&&<small>Pega el enlace completo de la página de tu Lock para seleccionar su red automáticamente. Ethereum Sepolia y Base Sepolia son redes diferentes.</small>}</label>}
    <small>{network===84532||network===11155111?'Red de pruebas: utiliza ETH de prueba.':'Necesitas saldo en la moneda nativa de esta red para pagar las comisiones. Esta red utiliza fondos reales.'} Tu wallet confirma las transacciones. El precio y la duración deben coincidir con Unlock.</small>
    <button className="k2-primary" disabled={busy}>{busy?<LoaderCircle className="k2-spin" size={17}/>:<KeyRound size={17}/>} {busy?'Guardando…':existing?'Guardar cambios':importing?'Vincular Lock':'Crear Lock y guardar plan'}</button>
  </fieldset>{status&&<p className="k2-notice" role="status">{status}</p>}{error&&<p className="k2-error" role="alert">{error}</p>}</form>;
}
export function Publisher({creator,plans,onPublished}:{creator:string;plans:CreatorPlan[];onPublished:(p:PublicPost)=>void}) {
  const [type,setType]=useState<ContentType>('video'),[title,setTitle]=useState(''),[intro,setIntro]=useState(''),[body,setBody]=useState(''),[category,setCategory]=useState('Viajes'),[access,setAccess]=useState('free'),[file,setFile]=useState<File|null>(null),[cover,setCover]=useState<File|null>(null),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState('');
  useEffect(()=>{const selected=new URLSearchParams(window.location.search).get('type');if(selected&&['video','image','audio','document','text'].includes(selected))setType(selected as ContentType);},[]);
  const controller=useRef<AbortController|null>(null);
  const [progress,setProgress]=useState<number|null>(null);
  async function upload(f:File,role:string){setStatus('Subiendo '+f.name+'…');setProgress(0);return uploadFile(f,role,setProgress,controller.current!.signal);}
  async function publish(e:FormEvent){e.preventDefault();controller.current=new AbortController();setBusy(true);setError('');setProgress(null);try{
    const plan=plans.find(p=>p.id===access);if(access!=='free'&&!plan)throw new Error('Selecciona un plan activo.');
    if(type!=='text'&&!file)throw new Error('Selecciona el archivo completo.');
    if(file&&file.size>MAX_FILE_SIZE)throw new Error('El archivo supera 500 MB.');
    let assetId:string|null=null,previewId:string|null=null,thumbnailId:string|null=null;
    let generated:File|undefined,generatedCover:File|undefined;
    if(file&&plan) {
      setStatus('Preparando el adelanto gratuito. Mantén abierta esta pestaña.');
      if(type==='video'){const r=await videoPreview(file,s=>setStatus(`Preparando adelanto: ${s.toFixed(0)} / 10 segundos…`));generated=r.preview;generatedCover=r.cover;}
      if(type==='audio')generated=await audioPreview(file);
      if(type==='image'){generated=await imagePreview(file);generatedCover=generated;}
    }
    setStatus('Subiendo los archivos…');
    if(file)assetId=await upload(file,'full');
    if(generated)previewId=await upload(generated,'preview');
    if(cover||generatedCover)thumbnailId=await upload((cover||generatedCover)!,'thumbnail');
    else if(file&&type==='image')thumbnailId=await upload(await imagePreview(file),'thumbnail');
    const draft:Draft={creator,title,intro,body,visibility:plan?'members':'free',planId:plan?.id||null,lock:plan?.lock||'',network:plan?.network||1,type,category,assetId,previewId,thumbnailId};
    let proof={};if(plan){const wallet=await connectWallet();setStatus('Firma para publicar con tu membresía.');proof=await signProof('publish',wallet,plan.network,{draft});}
    const result=await api<{post:PublicPost}>('/api/posts',{draft,...proof});onPublished(result.post);
  }catch(e){setError(errorText(e));}finally{setBusy(false);setStatus('');setProgress(null);controller.current=null;}}
  return <form className="k2-publisher k2-form" onSubmit={publish}><fieldset disabled={busy}><div className="k2-type-picker">{formats.map(t=><button key={t} type="button" className={type===t?'active':''} onClick={()=>{setType(t);setFile(null);setAccess('free');}}>{mediaLabels[t]}</button>)}</div>
    {type!=='text'&&<label className="k2-dropzone"><Upload size={34}/><strong>{file?file.name:'Selecciona tu archivo completo'}</strong><span>{type==='video'?'MP4 o WebM':type==='audio'?'MP3, WAV u OGG':type==='image'?'JPG, PNG o WebP':'PDF o TXT'} · Hasta 500 MB por archivo</span><input key={type} type="file" required accept={type==='video'?'.mp4,.webm':type==='audio'?'.mp3,.wav,.ogg':type==='image'?'.jpg,.jpeg,.png,.webp':'.pdf,.txt'} onChange={e=>setFile(e.target.files?.[0]||null)}/></label>}
    <label>Título<input required minLength={4} maxLength={100} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Dale un nombre a tu próxima publicación"/></label>
    <label>Introducción gratuita<textarea required minLength={30} maxLength={2500} rows={3} value={intro} onChange={e=>setIntro(e.target.value)} placeholder="Una muestra de lo que van a descubrir…"/></label>
    <label>{type==='text'?'Artículo completo':'Descripción completa (opcional)'}<textarea required={type==='text'} minLength={type==='text'?60:undefined} maxLength={60000} rows={type==='text'?8:3} value={body} onChange={e=>setBody(e.target.value)} placeholder={type==='text'?'Escribe aquí el contenido que leerán tus miembros':'Añade notas o detalles para acompañar el archivo'}/></label>
    <div className="k2-columns"><label>Categoría<select value={category} onChange={e=>setCategory(e.target.value)}>{CATEGORIES.slice(5).map(c=><option key={c}>{c}</option>)}</select></label><label>Acceso<select value={access} onChange={e=>setAccess(e.target.value)}><option value="free">Gratis · contenido completo</option>{plans.filter(p=>p.coverage.includes(type)).map(p=><option key={p.id} value={p.id}>{p.name}{p.slot==='basic'?' · también Premium':' · solo Premium'}</option>)}</select></label></div>
    {access==='free'?<p className="k2-notice">Todos podrán disfrutar esta publicación completa, sin comprar una membresía.</p>:<p className="k2-notice">{type==='video'||type==='audio'?'Generaremos un archivo público de hasta 10 segundos. Después aparecerá la opción de comprar tu membresía.':type==='image'?'Se mostrará una copia reducida y difuminada; el original será exclusivo.':'La introducción será pública y el contenido completo será exclusivo.'}</p>}
    {!plans.length&&<p className="k2-small">Para publicar contenido exclusivo, crea primero tus planes en «Mis planes».</p>}
    <label>Portada pública (opcional)<input type="file" accept=".jpg,.jpeg,.png,.webp" onChange={e=>setCover(e.target.files?.[0]||null)}/></label>
    <button className="k2-primary" disabled={busy}>{busy?<LoaderCircle className="k2-spin" size={18}/>:<Upload size={18}/>} {busy?'Preparando publicación…':'Publicar contenido'}</button>
  </fieldset>{progress!==null&&<div className="k2-upload-progress" aria-live="polite"><progress value={progress} max={100} aria-label="Progreso de carga"/><span>{Math.floor(progress)} %</span>{progress<100&&<button type="button" className="k2-secondary" onClick={()=>controller.current?.abort()}>Cancelar carga</button>}</div>}{status&&<p className="k2-notice" role="status">{status}</p>}{error&&<p className="k2-error" role="alert">{error}</p>}</form>;
}
