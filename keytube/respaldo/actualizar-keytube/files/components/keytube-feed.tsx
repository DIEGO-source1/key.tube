"use client";
import {useEffect,useState} from 'react';
import {Bookmark,Ellipsis,ExternalLink,Globe,LockKeyhole,MessageCircle,Share2,Trash2,EyeOff,Settings} from 'lucide-react';
import {ContentMedia,CreatorAvatar} from './keytube-content';
import {api,errorText,mediaLabels} from '@/lib/keytube-client';
import type {FullContent,PublicPost} from '@/lib/keytube-types';

export function FeedPost({post,saved,own,onOpen,onCreator,onSave,onDelete,onManage,onNotice}:{
  post:PublicPost;saved:boolean;own:boolean;onOpen:()=>void;onCreator:()=>void;
  onSave:()=>void;onDelete:()=>void;onManage:()=>void;onNotice:(message:string)=>void;
}) {
  const [expanded,setExpanded]=useState(false),[full,setFull]=useState<FullContent|null>(null),[gate,setGate]=useState(false),[error,setError]=useState(''),[shareUrl,setShareUrl]=useState('');
  const free=post.visibility==='free';
  useEffect(()=>{
    let active=true;setFull(null);setError('');setGate(false);
    if(free||own)api<FullContent>((own?'/api/studio?post=':'/api/free-content?post=')+post.id).then(data=>{if(active)setFull(data);}).catch(e=>{if(active)setError(errorText(e));});
    return()=>{active=false;};
  },[post.id,free,own,post.status,post.plan_id]);
  const date=new Date(post.created_at);
  const description=expanded||post.intro.length<=280?post.intro:post.intro.slice(0,280)+'…';
  async function share(){
    const url=new URL('/content/'+post.id,window.location.origin).href;
    try{await navigator.clipboard.writeText(url);onNotice('Enlace copiado. Ya puedes compartir esta publicación.');}
    catch{setShareUrl(url);}
  }
  return <article className="k2-feed-post" aria-label={post.title}>
    <header className="k2-feed-author">
      <button className="k2-creator-button" onClick={onCreator}>
        <CreatorAvatar name={post.creator} avatar={post.avatar} size={44}/>
        <span><strong>{post.creator}</strong><small><time dateTime={date.toISOString()}>{date.toLocaleString('es',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</time><span aria-hidden="true"> · </span>{free?<Globe size={12}/>:<LockKeyhole size={12}/>} {free?'Gratis':'Para miembros'}</small></span>
      </button>
      <details className="k2-post-menu"><summary aria-label="Opciones de publicación"><Ellipsis size={22}/></summary><div>
        <button onClick={onOpen}><ExternalLink size={16}/>Abrir publicación</button>
        <button onClick={onSave}><Bookmark size={16}/>{saved?'Quitar de guardados':'Guardar publicación'}</button>
        {own&&<button onClick={onManage}><Settings size={16}/>Cambiar acceso u ocultar</button>}{own&&<button className="danger" onClick={onDelete}><Trash2 size={16}/>Eliminar publicación</button>}
      </div></details>
    </header>
    {own&&<div className="k2-post-owner-controls">{post.status==='hidden'&&<span className="k2-badge"><EyeOff size={14}/>Oculta · solo tú</span>}<button className="k2-secondary" onClick={onManage}><Settings size={15}/>Acceso y visibilidad</button><button className="k2-delete" onClick={onDelete}><Trash2 size={15}/>Eliminar</button></div>}
    <div className="k2-feed-copy"><button className="k2-feed-title" onClick={onOpen}><h2>{post.title}</h2></button><p>{description}{post.intro.length>280&&<button className="k2-text-button" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?'Ver menos':'Ver más'}</button>}</p><span className="k2-feed-category">{mediaLabels[post.type||'text']} · {post.category}</span></div>
    <div className="k2-feed-media">
      {post.type==='text'?<div className="k2-feed-reading"><p>{full?full.body.slice(0,800):'Continúa leyendo esta publicación.'}</p>{full&&full.body.length>800&&<button className="k2-text-button" onClick={onOpen}>Leer completo →</button>}</div>:<ContentMedia post={post} full={full} onPreviewEnd={()=>setGate(true)} onError={()=>setError('No se pudo cargar el archivo. Abre la publicación para volver a intentarlo.')}/>}
    </div>
    {error&&<p className="k2-error" role="alert">{error}<button className="k2-text-button" onClick={onOpen}>Abrir publicación</button></p>}
    {!free&&!own&&<div className={`k2-feed-access ${gate?'ended':''}`}><LockKeyhole size={19}/><div><strong>{gate?'Terminó tu adelanto gratuito':'Un adelanto para descubrir'}</strong><small>{gate?'Compra una membresía del creador para continuar.':post.type==='video'||post.type==='audio'?'Hasta 10 segundos gratis. La experiencia completa, con tu membresía.':'Descubre la muestra y desbloquea el contenido completo.'}</small></div><button className="k2-primary" onClick={onOpen}>{gate?'Comprar membresía':'Ver membresía'}</button></div>}
    <footer className="k2-feed-actions">
      <button className={saved?'selected':''} aria-pressed={saved} onClick={onSave}><Bookmark size={18} fill={saved?'currentColor':'none'}/>{saved?'Guardado':'Guardar'}</button>
      <button onClick={onOpen}><MessageCircle size={18}/>Comentar</button>
      <button onClick={share}><Share2 size={18}/>Compartir</button>
    </footer>
    {shareUrl&&<label className="k2-share-link">Copia este enlace<input readOnly value={shareUrl} onFocus={e=>e.currentTarget.select()} aria-label="Enlace de la publicación"/></label>}
  </article>;
}
