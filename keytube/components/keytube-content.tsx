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
  Maximize2,
  Heart,
  MessageCircle,
  Share2,
  UserPlus,
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
function FeedMedia({ post, onOpen }: { post: PublicPost; onOpen: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [previewEnded, setPreviewEnded] = useState(false);
  const type = post.type || "text";
  const mediaUrl = post.preview_url;

  useEffect(() => { setPreviewEnded(false); }, [post.id, mediaUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || type !== "video" || !mediaUrl) return;
    const pauseWhenAnotherPlays = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail !== post.id) video.pause();
    };
    window.addEventListener("keytube-feed-play", pauseWhenAnotherPlays);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.62 && !previewEnded) {
          window.dispatchEvent(new CustomEvent("keytube-feed-play", { detail: post.id }));
          void video.play().catch(() => undefined);
        } else {
          video.pause();
        }
      },
      { threshold: [0, 0.35, 0.62, 0.85, 1] },
    );
    observer.observe(video);
    return () => {
      observer.disconnect();
      window.removeEventListener("keytube-feed-play", pauseWhenAnotherPlays);
      video.pause();
    };
  }, [mediaUrl, post.id, previewEnded, type]);

  if (type === "video" && mediaUrl) {
    return (
      <div className={`kt-feed-media kt-feed-video ${previewEnded ? "ended" : ""}`}>
        <video
          ref={videoRef}
          src={mediaUrl}
          poster={post.thumbnail_url}
          muted={muted}
          playsInline
          preload="metadata"
          loop={post.visibility === "free"}
          onPlay={() => window.dispatchEvent(new CustomEvent("keytube-feed-play", { detail: post.id }))}
          onEnded={() => {
            if (post.visibility !== "free") setPreviewEnded(true);
          }}
          onClick={event => {
            const video = event.currentTarget;
            if (video.paused) void video.play().catch(() => undefined);
            else video.pause();
          }}
        />
        <div className="kt-feed-video-actions">
          <button
            type="button"
            className="kt-feed-media-action"
            aria-label={muted ? "Activar sonido" : "Silenciar"}
            onClick={event => {
              event.stopPropagation();
              const next = !muted;
              setMuted(next);
              if (videoRef.current) {
                videoRef.current.muted = next;
                if (!next) void videoRef.current.play().catch(() => undefined);
              }
            }}
          >
            {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </button>
          <button type="button" className="kt-feed-media-action" aria-label="Abrir publicación" onClick={onOpen}>
            <Maximize2 size={17} />
          </button>
        </div>
        <span className="kt-feed-media-label">
          {post.visibility === "free" ? "Reproducción automática" : "Adelanto para miembros"}
        </span>
        {previewEnded && (
          <button type="button" className="kt-feed-preview-ended" onClick={onOpen}>
            <LockKeyhole size={25} />
            <strong>Adelanto terminado</strong>
            <span>Abre la publicación para desbloquear el video completo.</span>
          </button>
        )}
      </div>
    );
  }

  if (type === "image" && (mediaUrl || post.thumbnail_url)) {
    return (
      <button type="button" className="kt-feed-media kt-feed-image" onClick={onOpen} aria-label={`Abrir ${post.title}`}>
        <img src={post.thumbnail_url || mediaUrl} alt={post.title} loading="lazy" />
        {post.visibility !== "free" && <span className="kt-feed-media-label">Vista previa</span>}
      </button>
    );
  }

  if (type === "audio" && mediaUrl) {
    return (
      <div className="kt-feed-media kt-feed-audio">
        <Headphones size={30} />
        <div>
          <strong>{post.title}</strong>
          <small>{post.visibility === "free" ? "Audio completo" : "Adelanto de audio"}</small>
          <audio controls preload="metadata" src={mediaUrl} />
        </div>
      </div>
    );
  }

  const Icon =
    type === "audio" ? Headphones : type === "image" ? ImageIcon : type === "text" || type === "document" ? FileText : Play;
  return (
    <button type="button" className="kt-feed-media kt-feed-generated" onClick={onOpen} aria-label={`Abrir ${post.title}`}>
      {post.thumbnail_url ? (
        <img src={post.thumbnail_url} alt="" loading="lazy" />
      ) : (
        <span className={`kt-generated-cover ${type}`}>
          <Icon size={54} />
          <span>{post.category}</span>
        </span>
      )}
      <span className="kt-thumb-play"><Icon size={26} fill={type === "video" ? "currentColor" : "none"} /></span>
    </button>
  );
}

export function ContentCard({
  post,
  saved,
  liked,
  following,
  index,
  onOpen,
  onSave,
  onLike,
  onFollow,
  onShare,
  onComments,
  onCreator,
}: {
  post: PublicPost;
  saved: boolean;
  liked: boolean;
  following: boolean;
  index?: number;
  onOpen: () => void;
  onSave: () => void;
  onLike: () => void;
  onFollow: () => void;
  onShare: () => void;
  onComments: () => void;
  onCreator: () => void;
}) {
  const published = new Date(post.created_at).toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const indexLabel = String(index || 1).padStart(2, "0");
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
          <button className={`kt-follow-button ${following ? "following" : ""}`} onClick={onFollow}>
            <UserPlus size={14}/>{following ? "Siguiendo" : "Seguir"}
          </button>
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

      <FeedMedia post={post} onOpen={onOpen} />

      <footer className="kt-feed-card-footer kt-social-footer">
        <button className={`kt-social-action ${liked ? "selected" : ""}`} onClick={onLike} aria-pressed={liked}>
          <Heart size={18} fill={liked ? "currentColor" : "none"}/><span>{post.likes || 0}</span>
        </button>
        <button className="kt-social-action" onClick={onComments}>
          <MessageCircle size={18}/><span>{post.comment_count || 0}</span>
        </button>
        <button className="kt-social-action" onClick={onShare}>
          <Share2 size={18}/><span>Compartir</span>
        </button>
        <button className={`kt-social-action ${saved ? "selected" : ""}`} onClick={onSave}>
          <Bookmark size={18} fill={saved ? "currentColor" : "none"}/><span>Guardar</span>
        </button>
        <span className="kt-card-views"><Eye size={14} /> {post.views || 0} vistas</span>
        <span className="kt-access-badge">
          <LockKeyhole size={13} />
          {post.visibility === "free" ? "Gratis" : "Miembros"}
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
  const pixelRef = useRef<HTMLCanvasElement>(null);
  const [previewBlocked,setPreviewBlocked]=useState(false);
  useEffect(()=>{setPreviewBlocked(false);},[full?.mediaUrl,post.id]);
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
            playsInline
            preload="metadata"
            poster={post.thumbnail_url}
            src={url}
            onError={onError}
            onTimeUpdate={e => {if (!full && post.visibility !== "free" && e.currentTarget.currentTime >= 9.8) pixelateAndLock(e.currentTarget);}}
            onEnded={e => {if (!full && post.visibility !== "free") pixelateAndLock(e.currentTarget);}}
          />
          <canvas ref={pixelRef} className="kt-pixelated-preview" aria-hidden="true"/>
          {previewBlocked&&<div className="kt-pixel-lock"><LockKeyhole size={34}/><strong>Adelanto terminado</strong><span>Desbloquea el contenido para seguir viendo.</span></div>}
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
            <span>El creador compartirá un adelanto aquí.</span>
          </div>
        )}
        <span className="kt-player-label">
          {full ? "Contenido completo" : previewBlocked ? "Vista bloqueada · requiere membresía" : "Adelanto gratuito · 10 segundos"}
        </span>
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
          <p>{full ? "Sesión completa" : "Escucha el adelanto"}</p>
          {url ? (
            <audio
              key={url}
              controls
              preload="metadata"
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
  if (type === "image")
    return (
      <div className="kt-photo-view">
        {url || post.thumbnail_url ? (
          <img
            src={url || post.thumbnail_url}
            alt={post.title}
            onError={onError}
          />
        ) : (
          <ImageIcon size={60} />
        )}
        <span className="kt-player-label">
          {full ? "Imagen completa" : "Imagen de muestra"}
        </span>
      </div>
    );
  if (type === "document")
    return (
      <div className="kt-document-view">
        <FileText size={48} />
        <h2>{post.title}</h2>
        <p>
          {full
            ? "Tu documento completo está disponible."
            : "Descubre la introducción antes de acceder al documento."}
        </p>
        {url && (
          <Button asChild className="kt-button">
            <a href={url} download>
              <Download size={16} />
              {full ? "Descargar documento" : "Descargar muestra"}
              <ArrowUpRight size={15} />
            </a>
          </Button>
        )}
      </div>
    );
  return (
    <div className="kt-article-cover">
      <FileText size={36} />
      <span>LECTURA EXCLUSIVA</span>
      <h2>{post.title}</h2>
    </div>
  );
}
