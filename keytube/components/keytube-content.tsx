"use client";
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
  if (type === "video")
    return (
      <div className="kt-video-frame">
        {url ? (
          <video
            key={url}
            controls
            playsInline
            preload="metadata"
            poster={post.thumbnail_url}
            src={url}
            onError={onError}
            onTimeUpdate={e => {if (!full && post.visibility !== "free" && e.currentTarget.currentTime >= 10) {e.currentTarget.pause();onPreviewEnd?.();}}}
            onEnded={() => {if (!full && post.visibility !== "free") onPreviewEnd?.();}}
          />
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
          {full ? "Contenido completo" : "Adelanto público"}
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
