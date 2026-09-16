"use client";
import {useState,useRef,useEffect,type ReactNode,type FormEvent} from 'react';
import {X,Upload,Check,KeyRound,Mail,ShieldCheck,ArrowRight,LoaderCircle,Camera,Trash2} from 'lucide-react';
import {Brand,CreatorAvatar} from './keytube-content';
import {api,connectWallet,signProof,errorText,mediaLabels,walletNetwork} from '@/lib/keytube-client';
import {deployPlanLock,updatePlanLock} from '@/lib/lock-client';
import {videoPreview,audioPreview,imagePreview,videoCover,optimizeImage} from '@/lib/preview-client';
import {upload as uploadBlob} from '@vercel/blob/client';
import {NETWORK_OPTIONS,CATEGORIES,type CreatorPlan,type ContentType,type Asset,type Draft,type PublicPost} from '@/lib/keytube-types';
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
  const [name,setName]=useState(existing?.name||(slot==='basic'?'Básico':'Premium')),
    [description,setDescription]=useState(existing?.description||''),
    [benefits,setBenefits]=useState(existing?.benefits.join('\n')||''),
    [coverage,setCoverage]=useState<ContentType[]>(existing?.coverage||formats),
    [price,setPrice]=useState(existing?.price||''),
    [days,setDays]=useState(existing?.durationDays||30),
    [network,setNetwork]=useState(existing?.network||sibling?.network||84532),
    [lock,setLock]=useState(existing?.lock||''),
    [importing,setImporting]=useState(!!existing),
    [busy,setBusy]=useState(false),
    [status,setStatus]=useState(''),
    [error,setError]=useState('');

  type Inspection={lock:string;network:number;networkName:string;price:string;durationDays:number;lockName:string};

  async function inspectLock(address=lock.trim()) {
    if(!/^0x[0-9a-fA-F]{40}$/.test(address))throw new Error('Escribe una dirección de Lock válida.');
    setStatus('Detectando la red y leyendo los datos reales del Lock…');
    let preferredNetwork=network;
    try { preferredNetwork=await walletNetwork(); } catch {}
    const {inspection}=await api<{inspection:Inspection}>('/api/plans',{lock:address,preferredNetwork},'PUT');
    if(sibling&&sibling.network!==inspection.network)throw new Error(`Ese Lock está en ${inspection.networkName}, pero tu otro plan usa otra red.`);
    setNetwork(inspection.network);
    setPrice(inspection.price);
    setDays(inspection.durationDays);
    setStatus(`Lock detectado en ${inspection.networkName}: ${inspection.price} ${inspection.network===137?'POL':'ETH'} · ${inspection.durationDays} días.`);
    return inspection;
  }

  async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{
    if(!coverage.length)throw new Error('Selecciona al menos un formato.');
    if(sibling){const basic=slot==='basic'?coverage:sibling.coverage,premium=slot==='premium'?coverage:sibling.coverage;if(basic.some(t=>!premium.includes(t)))throw new Error('Premium debe cubrir también los formatos del Básico.');}
    const wallet=await connectWallet();if(sibling&&sibling.wallet.toLowerCase()!==wallet.toLowerCase())throw new Error('Conecta la misma wallet que administra tu otro plan.');
    let address=lock.trim(),selectedNetwork=network,selectedPrice=price,selectedDays=days;
    if(!address&&!importing){
      if(!selectedPrice)throw new Error('Escribe el precio del plan.');
      address=await deployPlanLock({name,price:selectedPrice,durationDays:selectedDays,network:selectedNetwork},wallet,setStatus);
      setLock(address);setImporting(true);
    } else if(importing&&!existing) {
      const inspection=await inspectLock(address);
      selectedNetwork=inspection.network;selectedPrice=inspection.price;selectedDays=inspection.durationDays;
    } else if(existing) {
      await updatePlanLock({name,price:selectedPrice,durationDays:selectedDays,network:selectedNetwork,lock:address},wallet,setStatus);
    }
    if(!/^0x[0-9a-fA-F]{40}$/.test(address))throw new Error('Escribe la dirección del Lock o crea uno nuevo.');
    const plan={slot,name,description,benefits:benefits.split('\n').map(x=>x.trim()).filter(Boolean),coverage,price:selectedPrice,durationDays:selectedDays,network:selectedNetwork,lock:address};
    setStatus('Firma para vincular este plan con tu cuenta de KeyTube.');
    const proof=await signProof('plan',wallet,selectedNetwork,{plan});
    await api('/api/plans',{plan,...proof});
    setStatus('Plan guardado y conectado con Unlock.');
    onSaved();
  }catch(e){setError(errorText(e));setStatus('');}finally{setBusy(false);}}

  return <form className={`k2-plan-editor k2-form ${slot==='premium'?'premium':''}`} onSubmit={submit}>
    <div className="k2-row"><span className="k2-plan-icon"><KeyRound/></span><div><span className="k2-eyebrow">{slot==='basic'?'PRIMER NIVEL':'EXPERIENCIA COMPLETA'}</span><h2>{slot==='basic'?'Plan Básico':'Plan Premium'}</h2></div>{existing&&<span className="k2-badge free"><Check size={12}/> Activo</span>}</div>
    <p>{slot==='basic'?'La puerta de entrada a tu contenido exclusivo.':'Contenido Premium y todo lo incluido en Básico.'}</p>
    <fieldset disabled={busy}>
      <label>Nombre del plan<input required minLength={2} maxLength={65} value={name} onChange={e=>setName(e.target.value)}/></label>
      <label>Descripción<textarea maxLength={600} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Cuenta por qué vale la pena ser miembro"/></label>
      <div className="k2-columns">
        <label>Precio en {network===137?'POL':'ETH'}<input required={!importing||!!existing} readOnly={importing&&!existing} inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,18})?" value={price} onChange={e=>setPrice(e.target.value)} placeholder={importing?'Se detectará desde Unlock':'Ej. 0.001'}/></label>
        <label>Duración en días<input required={!importing||!!existing} readOnly={importing&&!existing} type="number" min={1} max={365} value={days} onChange={e=>setDays(Number(e.target.value))}/></label>
      </div>
      <label>Beneficios · uno por línea<textarea rows={3} value={benefits} onChange={e=>setBenefits(e.target.value)} placeholder={'Videos completos\nSesiones y material exclusivo'} /></label>
      <span className="k2-label">¿Qué formatos cubre?</span>
      <div className="k2-checks">{formats.map(t=><label key={t}><input type="checkbox" checked={coverage.includes(t)} onChange={e=>setCoverage(e.target.checked?[...coverage,t]:coverage.filter(x=>x!==t))}/>{mediaLabels[t]}</label>)}</div>
      <label>Red del plan<select value={network} disabled={!!existing||!!sibling||importing} onChange={e=>setNetwork(Number(e.target.value))}>{NETWORK_OPTIONS.map(n=><option key={n.id} value={n.id}>{n.name}</option>)}</select></label>
      {!existing&&<label className="k2-checkbox"><input type="checkbox" checked={importing} onChange={e=>{setImporting(e.target.checked);setError('');setStatus('');if(e.target.checked){setPrice('');setDays(30);}}}/> Ya tengo un Lock y quiero vincularlo</label>}
      {(importing||!!lock)&&<div className="k2-lock-linker"><label>Dirección del Lock<input required readOnly={!!existing} value={lock} onChange={e=>{setLock(e.target.value);setStatus('');}} placeholder="0x…" pattern="0x[0-9a-fA-F]{40}"/></label>{importing&&!existing&&<button type="button" className="k2-secondary" onClick={async()=>{setBusy(true);setError('');try{await inspectLock();}catch(e){setError(errorText(e));setStatus('');}finally{setBusy(false);}}}>Detectar datos del Lock</button>}</div>}
      <small>{importing&&!existing?'No necesitas elegir la red ni copiar el precio: KeyTube detecta el Lock en las redes compatibles y carga sus datos reales.':network===84532||network===11155111?'Red de pruebas: utiliza ETH de prueba. Tu wallet confirma las transacciones.':'Esta red utiliza fondos reales. Tu wallet confirma las transacciones.'}</small>
      <button className="k2-primary" disabled={busy}>{busy?<LoaderCircle className="k2-spin" size={17}/>:<KeyRound size={17}/>} {busy?'Guardando…':existing?'Guardar cambios':importing?'Vincular Lock':'Crear Lock y guardar plan'}</button>
    </fieldset>
    {status&&<p className="k2-notice" role="status">{status}</p>}
    {error&&<p className="k2-error" role="alert">{error}</p>}
  </form>;
}

export function ProfileEditor({
  profile,
  fallbackName,
  onSaved,
}:{
  profile:{name:string;bio:string;avatar:string;wallet:string}|null;
  fallbackName:string;
  onSaved:()=>Promise<void>|void;
}) {
  const [name,setName]=useState(profile?.name||fallbackName),
    [bio,setBio]=useState(profile?.bio||''),
    [avatar,setAvatar]=useState(profile?.avatar||''),
    [photo,setPhoto]=useState<File|null>(null),
    [preview,setPreview]=useState(''),
    [busy,setBusy]=useState(false),
    [status,setStatus]=useState(''),
    [error,setError]=useState('');

  useEffect(()=>{
    setName(profile?.name||fallbackName);
    setBio(profile?.bio||'');
    setAvatar(profile?.avatar||'');
  },[profile?.name,profile?.bio,profile?.avatar,fallbackName]);

  useEffect(()=>{
    if(!photo){setPreview('');return;}
    const url=URL.createObjectURL(photo);setPreview(url);
    return()=>URL.revokeObjectURL(url);
  },[photo]);

  async function save(e:FormEvent){e.preventDefault();setBusy(true);setError('');setStatus('');try{
    let nextAvatar=avatar;
    if(photo){
      if(photo.size>25*1024*1024)throw new Error('La foto seleccionada es demasiado grande. Elige una de hasta 25 MB.');
      setStatus('Optimizando tu foto para móvil…');
      const prepared=await optimizeImage(photo,900,3.2*1024*1024);
      setStatus('Subiendo tu foto de perfil…');
      const r=await fetch('/api/uploads?role=avatar',{method:'POST',headers:{'Content-Type':prepared.type,'X-File-Name':encodeURIComponent(prepared.name||'avatar.jpg')},body:prepared});
      const data=await r.json() as {asset?:Asset;error?:string};
      if(!r.ok||!data.asset)throw new Error(data.error||'No se pudo subir la foto de perfil.');
      nextAvatar=`asset:${data.asset.id}`;
    }
    setStatus('Guardando tu perfil…');
    await api('/api/account',{name,bio,avatar:nextAvatar});
    setAvatar(nextAvatar);setPhoto(null);setStatus('Perfil actualizado.');
    await onSaved();
  }catch(e){setError(errorText(e));setStatus('');}finally{setBusy(false);}}

  const shownAvatar=photo?null:avatar;
  return <form className="k2-form k2-profile-editor" onSubmit={save}>
    <div className="k2-profile-photo-row">
      {preview?<img className="kt-avatar k2-profile-photo-preview" src={preview} alt="Vista previa de tu foto" width={96} height={96}/>:<CreatorAvatar name={name||fallbackName} avatar={shownAvatar||undefined} size={96}/>}
      <div className="k2-profile-photo-actions">
        <strong>Foto de perfil</strong>
        <span>Foto desde móvil o PC · KeyTube la optimiza automáticamente</span>
        <label className="k2-secondary k2-file-button"><Camera size={16}/> Elegir foto<input type="file" accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif" onChange={e=>setPhoto(e.target.files?.[0]||null)}/></label>
        {(avatar||photo)&&<button type="button" className="k2-secondary" onClick={()=>{setPhoto(null);setAvatar('');setStatus('Se usarán tus iniciales al guardar.');}}><Trash2 size={15}/> Quitar foto</button>}
      </div>
    </div>
    <label>Nombre público<input value={name} onChange={e=>setName(e.target.value)} required minLength={2} maxLength={65}/></label>
    <label>Sobre ti<textarea value={bio} onChange={e=>setBio(e.target.value)} maxLength={500} rows={5} placeholder="Cuenta qué creas, qué te interesa o qué encontrará tu comunidad."/></label>
    <button className="k2-primary" disabled={busy}>{busy?<LoaderCircle className="k2-spin" size={17}/>:<Check size={17}/>} {busy?'Guardando…':'Guardar cambios del perfil'}</button>
    {status&&<p className="k2-notice" role="status">{status}</p>}
    {error&&<p className="k2-error" role="alert">{error}</p>}
  </form>;
}

const mimeByExt:Record<string,string>={mp4:'video/mp4',webm:'video/webm',mov:'video/quicktime',m4v:'video/x-m4v',mp3:'audio/mpeg',wav:'audio/wav',ogg:'audio/ogg',m4a:'audio/mp4',aac:'audio/aac',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',pdf:'application/pdf',txt:'text/plain'};
export function Publisher({creator,plans,onPublished}:{creator:string;plans:CreatorPlan[];onPublished:(p:PublicPost)=>void}) {
  const [type,setType]=useState<ContentType>('video'),[title,setTitle]=useState(''),[intro,setIntro]=useState(''),[body,setBody]=useState(''),[category,setCategory]=useState('Viajes'),[access,setAccess]=useState('free'),[file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState(''),[previewNote,setPreviewNote]=useState('');
  async function uploadSmall(f:File,role:string){const mime=f.type.split(';')[0]||mimeByExt[f.name.split('.').pop()?.toLowerCase()||''];if(f.size>20*1024*1024)throw new Error('Portadas y adelantos deben pesar como máximo 20 MB.');const r=await fetch(`/api/uploads?role=${role}`,{method:'POST',headers:{'Content-Type':mime,'X-File-Name':encodeURIComponent(f.name)},body:f});const data=await r.json() as {asset:Asset;error?:string};if(!r.ok)throw new Error(data.error||'No se pudo subir el archivo.');return data.asset.id;}
  async function uploadFull(f:File){
    const mime=(f.type.split(';')[0]||mimeByExt[f.name.split('.').pop()?.toLowerCase()||'']).toLowerCase();
    if(f.size>500*1024*1024)throw new Error('El archivo completo debe pesar como máximo 500 MB.');
    const assetId=crypto.randomUUID(),ext=(f.name.split('.').pop()||'bin').replace(/[^a-z0-9]/gi,'').toLowerCase()||'bin';
    const pathname=`keytube/full/${assetId}.${ext}`;
    setStatus('Subiendo archivo completo: 0%');
    const safeName=(f.name||'archivo').replace(/[\r\n\x00-\x1f]/g,'').slice(0,150)||'archivo';
    const blob=await uploadBlob(pathname,f,{access:'private',contentType:mime,handleUploadUrl:'/api/blob-upload',clientPayload:JSON.stringify({assetId,name:safeName,mime,size:f.size}),multipart:f.size>8*1024*1024,onUploadProgress:({percentage})=>setStatus(`Subiendo archivo completo: ${Math.round(percentage)}%`)});
    const result=await api<{asset:Asset}>('/api/blob-upload/finalize',{assetId,pathname:blob.pathname,name:safeName,mime,size:f.size});
    return result.asset.id;
  }
  async function publish(e:FormEvent){e.preventDefault();setBusy(true);setError('');setPreviewNote('');try{
    const plan=plans.find(p=>p.id===access);if(access!=='free'&&!plan)throw new Error('Selecciona un plan activo.');
    if(type!=='text'&&!file)throw new Error('Selecciona el archivo completo.');
    if(file&&file.size>500*1024*1024)throw new Error('El archivo supera 500 MB.');
    if(typeof navigator!=='undefined'&&!navigator.onLine)throw new Error('No tienes conexión a internet. Vuelve a intentarlo cuando estés en línea.');
    let assetId:string|null=null,previewId:string|null=null,thumbnailId:string|null=null;
    let generated:File|undefined,generatedCover:File|undefined;
    if(file&&plan) {
      setStatus('Preparando el adelanto gratuito. Mantén KeyTube abierto durante la carga.');
      try{
        if(type==='video'){const r=await videoPreview(file,s=>setStatus(`Preparando adelanto: ${s.toFixed(0)} / 10 segundos…`));generated=r.preview;generatedCover=r.cover;}
        if(type==='audio')generated=await audioPreview(file);
        if(type==='image'){generated=await imagePreview(file);generatedCover=generated;}
      }catch(previewError){
        const message='Tu dispositivo no pudo generar el adelanto automático. El contenido completo seguirá protegido y se publicará con la portada o introducción disponible.';
        setPreviewNote(message);
        setStatus(message);
        if(type==='video'){try{generatedCover=await videoCover(file);}catch{}}
        if(type==='image'){try{generatedCover=await optimizeImage(file,1200,3.2*1024*1024);}catch{}}
      }
    }
    setStatus(file&&file.size>8*1024*1024?'Subiendo directamente al almacenamiento seguro. No cierres esta pestaña…':'Subiendo los archivos…');
    if(file)assetId=await uploadFull(file);
    if(generated)previewId=await uploadSmall(generated,'preview');
    // La portada ya no se elige manualmente. KeyTube la prepara automáticamente
    // desde el propio contenido para que publicar desde móvil sea más simple.
    if(file&&!generatedCover&&type==='video'){
      try{generatedCover=await videoCover(file);}catch{}
    }
    if(file&&!generatedCover&&type==='image'){
      try{generatedCover=await optimizeImage(file,1600,3.2*1024*1024);}catch{}
    }
    if(generatedCover)thumbnailId=await uploadSmall(generatedCover,'thumbnail');
    const draft:Draft={creator,title,intro,body,visibility:plan?'members':'free',planId:plan?.id||null,lock:plan?.lock||'',network:plan?.network||84532,type,category,assetId,previewId,thumbnailId};
    setStatus('Guardando tu publicación…');
    const result=await api<{post:PublicPost}>('/api/posts',{draft});onPublished(result.post);
  }catch(e){setError(errorText(e));}finally{setBusy(false);setStatus('');}}
  return <form className="k2-publisher k2-form" onSubmit={publish}><fieldset disabled={busy}><div className="k2-type-picker">{formats.map(t=><button key={t} type="button" className={type===t?'active':''} onClick={()=>{setType(t);setFile(null);setAccess('free');}}>{mediaLabels[t]}</button>)}</div>
    {type!=='text'&&<label className="k2-dropzone"><Upload size={34}/><strong>{file?file.name:'Selecciona tu archivo completo'}</strong><span>{type==='video'?'Video desde móvil o PC · MP4, MOV, WebM':type==='audio'?'Audio · MP3, M4A, WAV, OGG':type==='image'?'Foto o imagen desde móvil o PC':'PDF o TXT'} · Hasta 500 MB</span><input key={type} type="file" required accept={type==='video'?'video/*,.mp4,.mov,.m4v,.webm':type==='audio'?'audio/*,.mp3,.m4a,.aac,.wav,.ogg':type==='image'?'image/*,.jpg,.jpeg,.png,.webp,.heic,.heif':'.pdf,.txt,application/pdf,text/plain'} onChange={e=>{setFile(e.target.files?.[0]||null);setPreviewNote('');setError('');}}/></label>}
    <label>Título<input required minLength={4} maxLength={100} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Dale un nombre a tu próxima publicación"/></label>
    <label>Introducción gratuita<textarea required minLength={30} maxLength={2500} rows={3} value={intro} onChange={e=>setIntro(e.target.value)} placeholder="Una muestra de lo que van a descubrir…"/></label>
    <label>{type==='text'?'Artículo completo':'Descripción completa (opcional)'}<textarea required={type==='text'} minLength={type==='text'?60:undefined} maxLength={60000} rows={type==='text'?8:3} value={body} onChange={e=>setBody(e.target.value)} placeholder={type==='text'?'Escribe aquí el contenido que leerán tus miembros':'Añade notas o detalles para acompañar el archivo'}/></label>
    <div className="k2-columns"><label>Categoría<select value={category} onChange={e=>setCategory(e.target.value)}>{CATEGORIES.slice(5).map(c=><option key={c}>{c}</option>)}</select></label><label>Acceso<select value={access} onChange={e=>setAccess(e.target.value)}><option value="free">Gratis · contenido completo</option>{plans.filter(p=>p.coverage.includes(type)).map(p=><option key={p.id} value={p.id}>{p.name}{p.slot==='basic'?' · también Premium':' · solo Premium'}</option>)}</select></label></div>
    {access==='free'?<p className="k2-notice">Todos podrán disfrutar esta publicación completa, sin comprar una membresía.</p>:<p className="k2-notice">{type==='video'?'Generaremos un adelanto gratuito de 10 segundos. Al terminar, el video se pixelará y aparecerá la opción de comprar tu membresía.':type==='audio'?'Generaremos un adelanto gratuito de 10 segundos. Después se detendrá y aparecerá la opción de comprar tu membresía.':type==='image'?'Se mostrará una copia reducida y difuminada; el original será exclusivo.':'La introducción será pública y el contenido completo será exclusivo.'}</p>}
    {!plans.length&&<p className="k2-small">Para publicar contenido exclusivo, crea primero tus planes en «Mis planes».</p>}
    <p className="k2-small k2-mobile-upload-help">En móvil la subida va directamente al almacenamiento de KeyTube. Puedes publicar sin conectar MetaMask. Para video, MP4 H.264 ofrece la mejor compatibilidad entre dispositivos.</p>
    {previewNote&&<p className="k2-notice" role="status">{previewNote}</p>}
    <p className="k2-small k2-auto-cover-note">No necesitas añadir portada: KeyTube usa automáticamente el video o la imagen y, cuando hace falta, genera una vista previa desde el propio archivo.</p>
    <button className="k2-primary" disabled={busy}>{busy?<LoaderCircle className="k2-spin" size={18}/>:<Upload size={18}/>} {busy?'Preparando publicación…':'Publicar contenido'}</button>
  </fieldset>{status&&<p className="k2-notice" role="status">{status}</p>}{error&&<p className="k2-error" role="alert">{error}</p>}</form>;
}
