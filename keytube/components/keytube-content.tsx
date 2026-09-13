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
  onOpen,
  onSave,
  onCreator,
}: {
  post: PublicPost;
  saved: boolean;
  onOpen: () => void;
  onSave: () => void;
  onCreator: () => void;
}) {
  const Icon =
    post.type === "audio"
      ? Headphones
      : post.type === "image"
        ? ImageIcon
        : post.type === "text" || post.type === "document"
          ? FileText
          : Play;
  return (
    <article className="kt-content-card">
      <div className="kt-thumb">
        <button
          className="kt-open-thumbnail"
          onClick={onOpen}
          aria-label={`Abrir ${post.title}`}
        >
          {post.thumbnail_url ? (
            <img src={post.thumbnail_url} alt="" loading="lazy" />
          ) : (
            <span className={`kt-generated-cover ${post.type || "text"}`}>
              <Icon size={40} />
              <span>{post.category}</span>
            </span>
          )}
          <span className="kt-thumb-play">
            <Icon
              size={20}
              fill={post.type === "video" ? "currentColor" : "none"}
            />
          </span>
          {post.duration && (
            <span className="kt-duration">{post.duration}</span>
          )}
        </button>
        <button
          className={`kt-save ${saved ? "selected" : ""}`}
          aria-label={saved ? "Quitar de guardados" : "Guardar publicación"}
          aria-pressed={saved}
          onClick={onSave}
        >
          <Bookmark size={16} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="kt-card-copy">
        <button className="kt-card-title" onClick={onOpen}>
          {post.title}
        </button>
        <button className="kt-creator-link" onClick={onCreator}>
          <CreatorAvatar name={post.creator} avatar={post.avatar} size={22} />
          <span>{post.creator}</span>
        </button>
        <span className="kt-card-category">
          {mediaLabels[post.type || "text"]} · {post.category}
        </span>
        <span className="kt-card-views"><Eye size={12} /> {post.views || 0} vistas</span>
        <span className="kt-access-badge">
          <LockKeyhole size={12} />
          {post.visibility === "free" ? "Gratis · contenido completo" : "Solo miembros · adelanto gratis"}
        </span>
      </div>
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
