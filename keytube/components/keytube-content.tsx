"use client";
import { useEffect, useRef, useState } from "react";
import {
  Bookmark,
  Play,
  LockKeyhole,
  FileText,
  Headphones,
  Image as ImageIcon,
  Download,
  ArrowUpRight,
  Eye,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublicPost, FullContent } from "@/lib/keytube-types";
import { mediaLabels } from "@/lib/keytube-client";
export function Brand({ large = false }: { large?: boolean }) {
  return (
    <span className={`kt-brand ${large ? "large" : ""}`}>
      <span className="kt-brand-icon">
        <Play fill="currentColor" strokeWidth={1.5} />
      </span>
      <span>
        Key<span className="kt-gradient-text">Tube</span>
      </span>
    </span>
  );
}
export function CreatorAvatar({
  name,
  avatar,
  size = 32,
}: {
  name: string;
  avatar?: string;
  size?: number;
}) {
  const src = avatar
    ? avatar.startsWith("asset:")
      ? `/api/avatar/${avatar.slice(6)}`
      : `/images/${avatar}.jpg`
    : "";
  return src ? (
    <img
      className="kt-avatar"
      src={src}
      alt=""
      width={size}
      height={size}
    />
  ) : (
    <span
      className="kt-avatar kt-initials"
      style={{ width: size, height: size }}
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}
export function ContentCard({
  post,
  saved,
  index,
  onOpen,
  onSave,
  onCreator,
  liked,
  following,
  canFollow,
  onLike,
  onFollow,
  onShare,
  onComments,
}: {
  post: PublicPost;
  saved: boolean;
  index?: number;
  liked?: boolean;
  following?: boolean;
  canFollow?: boolean;
  onOpen: () => void;
  onSave: () => void;
  onCreator: () => void;
  onLike?: () => void;
  onFollow?: () => void;
  onShare?: () => void;
  onComments?: () => void;
}) {
  const Icon =
    post.type === "audio"
      ? Headphones
      : post.type === "image"
        ? ImageIcon
        : post.type === "text" || post.type === "document"
          ? FileText
          : Play;
  const published = new Date(post.created_at).toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const cardThumbnail = post.type === "image"
    ? post.visibility === "free"
      ? (post.preview_url || post.thumbnail_url)
      : (post.preview_url || post.thumbnail_url)
    : post.thumbnail_url;
  const freeVideoUrl = post.type === "video" && post.visibility === "free" ? post.preview_url : undefined;
  const indexLabel = String(index || 1).padStart(2, "0");
  const feedVideoRef = useRef<HTMLVideoElement>(null);
  const [feedMuted, setFeedMuted] = useState(true);
  function toggleFeedSound() {
    const next = !feedMuted;
    setFeedMuted(next);
    const video = feedVideoRef.current;
    if (video) {
      video.muted = next;
      if (!next) void video.play().catch(() => {});
    }
  }
  useEffect(() => {
    const video = feedVideoRef.current;
    if (!video || !freeVideoUrl) return;

    let mostlyVisible = false;
    const syncPlayback = () => {
      if (document.hidden || !mostlyVisible) {
        if (!video.paused) video.pause();
        return;
      }
      if (video.paused) void video.play().catch(() => {});
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        mostlyVisible = entry.isIntersecting && entry.intersectionRatio >= 0.55;
        syncPlayback();
      },
      { threshold: [0, 0.25, 0.55, 0.75, 1] },
    );

    observer.observe(video);
    document.addEventListener("visibilitychange", syncPlayback);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", syncPlayback);
      video.pause();
    };
  }, [freeVideoUrl]);
  return (
    <article className="kt-content-card kt-feed-card">
      <header className="kt-feed-card-head">
        <button className="kt-creator-link kt-feed-creator" onClick={onCreator}>
          <CreatorAvatar name={post.creator} avatar={post.avatar} size={42} />
          <span>
            <strong>{post.creator}</strong>
            <small>{published} · {mediaLabels[post.type || "text"]}</small>
          </span>
        </button>
        <div className="kt-feed-head-actions">
          <span className="kt-feed-index" title={`Publicación ${indexLabel}`}>#{indexLabel}</span>
          <button
            className={`kt-feed-save ${saved ? "selected" : ""}`}
            aria-label={saved ? "Quitar de guardados" : "Guardar publicación"}
            aria-pressed={saved}
            onClick={onSave}
          >
            <Bookmark size={18} fill={saved ? "currentColor" : "none"} />
          </button>
        </div>
      </header>

      <div className="kt-feed-card-copy">
        <button className="kt-card-title" onClick={onOpen}>{post.title}</button>
        {!!post.intro && <p className="kt-card-intro">{post.intro}</p>}
        <div className="kt-feed-tags">
          <span>{mediaLabels[post.type || "text"]}</span>
          <span>{post.category || "General"}</span>
          <span>{post.visibility === "free" ? "Público" : "Miembros"}</span>
        </div>
      </div>

      <div className="kt-thumb">
        {freeVideoUrl ? (
          <div className="kt-open-thumbnail kt-free-video-card">
            <video
              ref={feedVideoRef}
              src={freeVideoUrl}
              poster={post.thumbnail_url}
              muted={feedMuted}
              loop
              playsInline
              controls
              preload="metadata"
              aria-label={`Video gratuito: ${post.title}`}
            />
            <button
              className="kt-video-sound-toggle kt-feed-sound-toggle"
              type="button"
              onClick={toggleFeedSound}
              aria-label={feedMuted ? "Activar sonido" : "Silenciar video"}
              title={feedMuted ? "Activar sonido" : "Silenciar video"}
            >
              {feedMuted ? <VolumeX size={18}/> : <Volume2 size={18}/>}
            </button>
          </div>
        ) : (
          <button
            className="kt-open-thumbnail"
            onClick={onOpen}
            aria-label={`Abrir ${post.title}`}
          >
            {cardThumbnail ? (
              <img className={post.type === "image" && post.visibility !== "free" ? "kt-card-paid-image" : undefined} src={cardThumbnail} alt="" loading="lazy" />
            ) : (
              <span className={`kt-generated-cover ${post.type || "text"}`}>
                <Icon size={54} />
                <span>{post.category}</span>
              </span>
            )}
            <span className="kt-thumb-play">
              <Icon
                size={26}
                fill={post.type === "video" ? "currentColor" : "none"}
              />
            </span>
            {post.duration && <span className="kt-duration">{post.duration}</span>}
          </button>
        )}
      </div>

      <footer className="kt-feed-card-footer">
        <span className="kt-card-views"><Eye size={14} /> {post.views || 0} vistas</span>
        <span className="kt-card-category">{post.category || "General"}</span>
        <span className="kt-access-badge">
          <LockKeyhole size={13} />
          {post.visibility === "free" ? "Gratis · contenido completo" : "Solo miembros"}
        </span>
      </footer>
    </article>
  );
}
export function ContentMedia({
  post,
  full,
  onError,
  onPreviewEnd,
}: {
  post: PublicPost;
  full: FullContent | null;
  onError: () => void;
  onPreviewEnd?: () => void;
}) {
  const url = full?.mediaUrl || post.preview_url;
  const type = post.type || "text";
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const pixelRef = useRef<HTMLCanvasElement>(null);
  const [previewBlocked,setPreviewBlocked]=useState(false);
  const [videoMuted,setVideoMuted]=useState(true);
  useEffect(()=>{setPreviewBlocked(false);setVideoMuted(true);},[full?.mediaUrl,post.id]);
  useEffect(() => {
    const video = videoRef.current;
    if (type !== "video" || post.visibility !== "free" || !url || !video || previewBlocked) return;

    let mostlyVisible = false;
    const syncPlayback = () => {
      if (document.hidden || !mostlyVisible) {
        if (!video.paused) video.pause();
        return;
      }
      if (video.paused) void video.play().catch(() => {});
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        mostlyVisible = entry.isIntersecting && entry.intersectionRatio >= 0.55;
        syncPlayback();
      },
      { threshold: [0, 0.25, 0.55, 0.75, 1] },
    );

    observer.observe(video);
    document.addEventListener("visibilitychange", syncPlayback);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", syncPlayback);
      video.pause();
    };
  }, [type, post.visibility, url, previewBlocked]);
  useEffect(()=>{
    if(type!=="audio"||post.visibility!=="free"||!url)return;
    const audio=audioRef.current;if(!audio)return;
    const tryPlay=()=>{void audio.play().catch(()=>{});};
    tryPlay();
    // Chrome/Safari pueden bloquear audio audible hasta la primera interacción.
    // En ese caso arrancamos automáticamente en cuanto el usuario toca/clica la página.
    window.addEventListener("pointerdown",tryPlay,{once:true});
    window.addEventListener("keydown",tryPlay,{once:true});
    return()=>{window.removeEventListener("pointerdown",tryPlay);window.removeEventListener("keydown",tryPlay);};
  },[type,post.visibility,url]);
  function pixelateAndLock(video:HTMLVideoElement){
    if(full||post.visibility==='free'||previewBlocked)return;
    video.pause();
    const canvas=pixelRef.current;
    if(canvas&&video.videoWidth&&video.videoHeight){
      const ratio=video.videoWidth/video.videoHeight,w=Math.max(1,Math.round(video.clientWidth||640)),h=Math.max(1,Math.round(w/ratio));
      canvas.width=w;canvas.height=h;
      const tiny=document.createElement('canvas');tiny.width=48;tiny.height=Math.max(24,Math.round(48/ratio));
      const t=tiny.getContext('2d'),c=canvas.getContext('2d');
      if(t&&c){t.drawImage(video,0,0,tiny.width,tiny.height);c.imageSmoothingEnabled=false;c.drawImage(tiny,0,0,tiny.width,tiny.height,0,0,w,h);}
    }
    setPreviewBlocked(true);onPreviewEnd?.();
  }
  if (type === "video")
    return (
      <div className={`kt-video-frame ${previewBlocked?'kt-preview-locked':''}`}>
        {url ? (
          <>
          <video
            ref={videoRef}
            key={url}
            controls={!previewBlocked}
            muted={videoMuted}
            playsInline
            preload={post.visibility === "free" ? "auto" : "metadata"}
            poster={post.thumbnail_url}
            src={url}
            onError={onError}
            onTimeUpdate={e => {if (!full && post.visibility !== "free" && e.currentTarget.currentTime >= 9.8) pixelateAndLock(e.currentTarget);}}
            onEnded={e => {if (!full && post.visibility !== "free") pixelateAndLock(e.currentTarget);}}
          />
          {!previewBlocked&&<button
            className="kt-video-sound-toggle"
            type="button"
            onClick={()=>{
              const next=!videoMuted;
              setVideoMuted(next);
              const video=videoRef.current;
              if(video){video.muted=next;if(!next)void video.play().catch(()=>{});}
            }}
            aria-label={videoMuted?"Activar sonido":"Silenciar video"}
            title={videoMuted?"Activar sonido":"Silenciar video"}
          >{videoMuted?<VolumeX size={19}/>:<Volume2 size={19}/>}</button>}
          <canvas ref={pixelRef} className="kt-pixelated-preview" aria-hidden="true"/>
          {previewBlocked&&<div className="kt-pixel-lock"><LockKeyhole size={34}/><strong>Contenido exclusivo</strong><span>Desbloquea para seguir viendo.</span></div>}
          </>
        ) : (
          <div
            className="kt-media-placeholder"
            style={{
              backgroundImage: post.thumbnail_url
                ? `linear-gradient(#0003,#0009),url(${post.thumbnail_url})`
                : undefined,
            }}
          >
            <Play size={42} />
            <span>El creador compartirá el contenido aquí.</span>
          </div>
        )}
      </div>
    );
  if (type === "audio")
    return (
      <div className="kt-audio-player">
        {post.thumbnail_url && (
          <img src={post.thumbnail_url} alt="Portada del audio" />
        )}
        <div>
          <Headphones size={30} />
          <h2>{post.title}</h2>
          <p>{post.visibility === "free" ? "Canción completa" : full ? "Sesión completa" : "Contenido exclusivo"}</p>
          {url ? (
            <audio
              ref={audioRef}
              key={url}
              controls
              autoPlay={post.visibility === "free"}
              preload={post.visibility === "free" ? "auto" : "metadata"}
              src={url}
              onError={onError}
              onTimeUpdate={e => {if (!full && post.visibility !== "free" && e.currentTarget.currentTime >= 10) {e.currentTarget.pause();onPreviewEnd?.();}}}
              onEnded={() => {if (!full && post.visibility !== "free") onPreviewEnd?.();}}
            />
          ) : (
            <p>El audio estará disponible al desbloquear.</p>
          )}
        </div>
      </div>
    );
  if (type === "image") {
    const lockedPreview=!full&&post.visibility!=="free";
    return (
      <div className={`kt-photo-view ${lockedPreview?"kt-photo-locked":""}`}>
        {url || post.thumbnail_url ? (
          <img
            src={url || post.thumbnail_url}
            alt={post.title}
            onError={onError}
          />
        ) : (
          <ImageIcon size={60} />
        )}
        {lockedPreview&&<div className="kt-photo-lock"><LockKeyhole size={30}/><strong>Contenido exclusivo</strong><span>Desbloquea para ver la imagen original.</span></div>}
      </div>
    );
  }
  if (type === "document") {
    const lockedPreview=!full&&post.visibility!=="free";
    const frameUrl=url?`${url}#toolbar=0&navpanes=0&view=FitH`:"";
    return (
      <div className="kt-document-view">
        <FileText size={48} />
        <h2>{post.title}</h2>
        <p>
          {full
            ? "Documento completo desbloqueado."
            : lockedPreview
              ? "Páginas gratuitas disponibles. El resto requiere membresía."
              : "Documento completo disponible."}
        </p>
        {url&&<div className="kt-document-frame"><iframe src={frameUrl} title={`Vista de ${post.title}`} onError={onError}/></div>}
        {lockedPreview&&<div className="kt-document-lock-note"><LockKeyhole size={20}/><span><strong>Contenido exclusivo.</strong> Desbloquea la membresía para abrir todas las páginas.</span></div>}
        {url&&<Button asChild className="kt-button"><a href={url} target="_blank" rel="noreferrer"><Download size={16}/>{full?"Abrir documento completo":"Abrir páginas gratuitas"}<ArrowUpRight size={15}/></a></Button>}
      </div>
    );
  }
  return (
    <div className="kt-article-cover">
      <FileText size={36} />
      <span>LECTURA EXCLUSIVA</span>
      <h2>{post.title}</h2>
    </div>
  );
}
