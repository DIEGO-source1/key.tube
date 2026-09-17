"use client";
import {useState,type FormEvent} from 'react';
import {Camera,Check,ExternalLink,KeyRound,LoaderCircle,LogOut,Pencil,Play,Upload,UserRound,Wallet,X} from 'lucide-react';
import {CreatorAvatar} from './keytube-content';
import {api,errorText} from '@/lib/keytube-client';
import type {Asset} from '@/lib/keytube-types';
type Profile={name:string;bio:string;avatar:string};
export function ProfileEditor({user,profile,postCount,planCount,followingCount,google,walletLabel,onSaved,onNavigate,onWallet,onLogout}:{
  user:{id:string;name:string;email?:string};profile:Profile|null;postCount:number;planCount:number;followingCount:number;google:boolean;walletLabel:string;
  onSaved:()=>Promise<void>;onNavigate:(url:string)=>void;onWallet:()=>void;onLogout:()=>void;
}) {
  const initial=():Profile=>({name:profile?.name||user.name,bio:profile?.bio||'',avatar:profile?.avatar&&/^[a-f0-9-]{36}$/i.test(profile.avatar)?profile.avatar:''});
  const [editing,setEditing]=useState(false),[draft,setDraft]=useState<Profile>(initial),[busy,setBusy]=useState(false),[uploading,setUploading]=useState(false),[error,setError]=useState(''),[pendingAvatar,setPendingAvatar]=useState(false);
  function edit(){setDraft(initial());setError('');setPendingAvatar(false);setEditing(true);}
  async function photo(file?:File){
    if(!file)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>2*1024*1024){setError('Elige una foto JPG, PNG o WEBP de hasta 2 MB.');return;}
    setUploading(true);setError('');
    try {
      const r=await fetch('/api/uploads?role=avatar',{method:'POST',headers:{'Content-Type':file.type,'X-File-Name':encodeURIComponent(file.name)},body:file});
      const data=await r.json() as {asset?:Asset;error?:string};
      if(!r.ok||!data.asset)throw new Error(data.error||'No se pudo subir la foto.');
      setDraft(p=>({...p,avatar:data.asset!.id}));setPendingAvatar(true);
    }catch(e){setError(errorText(e));}finally{setUploading(false);}
  }
  async function save(e:FormEvent){
    e.preventDefault();setBusy(true);setError('');
    try{await api('/api/account',draft);await onSaved();setEditing(false);setPendingAvatar(false);}
    catch(e){setError(errorText(e));}finally{setBusy(false);}
  }
  return <div className="k2-profile-page"><div className="k2-profile-card">
    <div className="k2-profile-banner"><span>Tu espacio. Tu comunidad.</span></div>
    <div className="k2-profile-identity"><CreatorAvatar name={profile?.name||user.name} avatar={profile?.avatar} size={80}/><div><h2>{profile?.name||user.name}</h2><p>{user.email}</p></div></div>
    <p className="k2-profile-bio">{profile?.bio||'Cuéntale a tu comunidad qué te inspira y qué compartes.'}</p>
    <div className="k2-profile-primary-actions"><button className="k2-primary" onClick={edit} disabled={busy||uploading}><Pencil size={16}/>Editar perfil</button><button className="k2-secondary" onClick={()=>onNavigate('/creator/'+user.id)}><UserRound size={16}/>Ver perfil público</button></div>
    <div className="k2-stats"><span><strong>{postCount}</strong>Publicaciones</span><span><strong>{planCount}</strong>Planes</span><span><strong>{followingCount}</strong>Siguiendo</span></div>
    {editing&&<form className="k2-form k2-profile-edit" onSubmit={save}><h3>Editar mi perfil</h3><fieldset disabled={busy||uploading}>
      <div className="k2-avatar-edit">{pendingAvatar&&draft.avatar?<img className="kt-avatar" width={64} height={64} src={'/api/media/'+draft.avatar+'?owner=1'} alt="Nueva foto de perfil"/>:<CreatorAvatar name={draft.name} avatar={draft.avatar} size={64}/>}<label><span><Camera size={16}/>Cambiar foto</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>void photo(e.target.files?.[0])}/><small>JPG, PNG o WEBP · máximo 2 MB</small></label></div>
      {draft.avatar&&<button className="k2-text-button" type="button" onClick={()=>{setDraft(p=>({...p,avatar:''}));setPendingAvatar(false);}}>Quitar foto y usar mis iniciales</button>}
      <label>Nombre público<input required minLength={2} maxLength={65} value={draft.name} onChange={e=>setDraft(p=>({...p,name:e.target.value}))}/></label>
      <label>Biografía<textarea rows={4} maxLength={500} value={draft.bio} placeholder="¿Qué creas? ¿Qué encontrará tu comunidad aquí?" onChange={e=>setDraft(p=>({...p,bio:e.target.value}))}/><small>{draft.bio.length}/500</small></label>
    </fieldset>{error&&<p className="k2-error" role="alert">{error}</p>}
    <div className="k2-row"><button className="k2-primary" disabled={busy||uploading}>{busy||uploading?<LoaderCircle size={16} className="k2-spin"/>:<Check size={16}/>} {uploading?'Subiendo foto…':busy?'Guardando…':'Guardar cambios'}</button><button type="button" className="k2-secondary" disabled={busy||uploading} onClick={()=>{setEditing(false);setError('');}}><X size={16}/>Cancelar</button></div></form>}
    <div className="k2-profile-shortcuts"><button onClick={()=>onNavigate('/studio/upload')}><Upload size={22}/><strong>Crear publicación</strong><small>Video, foto, música o texto</small></button><button onClick={()=>onNavigate('/studio')}><Play size={22}/><strong>Mi contenido</strong><small>Administrar acceso y publicaciones</small></button><button onClick={()=>onNavigate('/memberships')}><KeyRound size={22}/><strong>Mis planes</strong><small>Gestionar mis membresías</small></button></div>
    <div className="k2-profile-links"><a className="k2-secondary" href="https://app.unlock-protocol.com/locks" target="_blank" rel="noreferrer"><KeyRound size={17}/>Abrir mi cuenta en Unlock<ExternalLink size={15}/></a><button className="k2-secondary" onClick={onWallet}><Wallet size={17}/>{walletLabel}</button>{google&&<a className="k2-secondary" href="/api/auth/google/start?link=1">Vincular mi cuenta con Google</a>}<button className="k2-secondary" onClick={onLogout}><LogOut size={17}/>Cerrar sesión</button></div>
  </div></div>;
}
