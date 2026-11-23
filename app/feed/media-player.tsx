"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AudioLines, Maximize, Pause, Play, Volume2, VolumeX, X } from "lucide-react";
import { copy, type Lang } from "../lib/locale";
export type Attachment = { position: number; kind: "image" | "video" | "audio"; title: string; deleted?: boolean };
const mib = 1024 * 1024;
const LIMITS: Record<string, number> = {
  "image/jpeg": 5, "image/png": 5, "image/webp": 5,
  "video/mp4": 64, "video/webm": 64,
  "audio/mpeg": 16, "audio/mp3": 16, "audio/mp4": 16, "audio/x-m4a": 16,
  "audio/ogg": 16, "audio/wav": 16, "audio/x-wav": 16, "audio/vnd.wave": 16,
};
export const fileAccept = Object.keys(LIMITS).join(",");
export function validAttachments(files: File[]) {
  return files.length <= 4 && files.every(file => file.size > 0 && file.size <= (LIMITS[file.type] ?? 0) * mib)
    && files.reduce((sum, file) => sum + file.size, 0) <= 96 * mib;
}
function timeCode(seconds: number) {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
export function MediaPlayer({ source, kind, title, lang }: {
  source: string; kind: "video" | "audio"; title: string; lang: Lang;
}) {
  const t = copy[lang].social;
  const element = useRef<HTMLMediaElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [error, setError] = useState(false);
  const video = kind === "video";
  const label = title || t[kind];
  function syncDuration() {
    const seconds = element.current?.duration ?? 0;
    setDuration(Number.isFinite(seconds) ? seconds : 0);
  }
  function toggle() {
    const media = element.current;
    if (!media) return;
    if (media.paused) {
      setError(false);
      void media.play().catch(cause => { if (cause?.name !== "AbortError") setError(true); });
    } else media.pause();
  }
  async function fullscreen() {
    const media = element.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (frame.current?.requestFullscreen) await frame.current.requestFullscreen();
      else media?.webkitEnterFullscreen?.();
    } catch {
      media?.webkitEnterFullscreen?.();
    }
  }
  const events = {
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false),
    onEnded: () => setPlaying(false),
    onVolumeChange: () => setMuted(element.current?.muted ?? false),
    onDurationChange: syncDuration,
    onTimeUpdate: () => setPosition(element.current?.currentTime ?? 0),
    onError: () => { setPlaying(false); setError(true); },
  };
  const transport = playing ? <Pause size={18} /> : <Play size={18} />;
  const seekValue = duration ? Math.min(duration, position) : 0;
  return <div className={`media-player media-${kind}`} ref={frame} role="group" aria-label={label}>
    {video ? <div className="video-stage">
      <video ref={node => { element.current = node; }} src={source} preload="metadata" playsInline aria-label={label} {...events} />
      <button type="button" className="video-toggle" onClick={toggle} aria-label={playing ? t.pause : t.play} data-playing={playing}>
        <span>{transport}</span>
      </button>
    </div> : <>
      <audio ref={node => { element.current = node; }} src={source} preload="none" {...events} />
      <div className="audio-title"><AudioLines size={22} aria-hidden="true" /><strong>{label}</strong></div>
    </>}
    <div className="media-control-bar">
      <button type="button" className="icon-action" onClick={toggle} aria-label={playing ? t.pause : t.play}>{transport}</button>
      <span className="media-time">{timeCode(seekValue)}</span>
      <input className="media-seek" type="range" min={0} max={duration || 1} step="any" value={seekValue}
        style={{ "--progress": `${duration ? seekValue / duration * 100 : 0}%` } as CSSProperties}
        aria-label={t.seek} aria-valuetext={timeCode(seekValue)} disabled={!duration}
        onChange={event => { if (element.current) element.current.currentTime = Number(event.target.value); }} />
      <span className="media-time">{duration ? timeCode(duration) : "–:––"}</span>
      <button type="button" className="icon-action" aria-label={muted ? t.unmute : t.mute}
        onClick={() => { if (element.current) element.current.muted = !element.current.muted; }}>
        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
      {video && <button type="button" className="icon-action" aria-label={t.fullscreen} onClick={() => void fullscreen()}><Maximize size={17} /></button>}
    </div>
    {error && <p className="social-error media-error" role="status">{t.playerError}</p>}
  </div>;
}
export function PostAttachments({ id, media, lang }: { id: string; media: Attachment[]; lang: Lang }) {
  if (!media.length) return null;
  return <div className="post-media">{media.map(file => {
    const source = `/api/posts/${id}/media/${file.position}`;
    return <div key={source}>{file.kind === "image"
      ? <img className="post-image" src={source} alt={copy[lang].social.imageAlt} loading="lazy" decoding="async" />
      : <MediaPlayer source={source} kind={file.kind} title={file.title} lang={lang} />}
      {file.deleted && <p className="removed-caption">{copy[lang].admin.deletedAsset}</p>}</div>;
  })}</div>;
}
export function DraftAttachment({ file, lang, remove, disabled }: { file: File; lang: Lang; remove: () => void; disabled: boolean }) {
  const image = file.type.startsWith("image/");
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!image) { setPreview(""); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file, image]);
  const t = copy[lang].social;
  return <div className="draft-attachment">
    {preview && <img src={preview} alt={t.draftImage} />}
    <span>{file.name}</span>
    <button type="button" className="icon-action" aria-label={t.removeMedia} onClick={remove} disabled={disabled}><X size={17} /></button>
  </div>;
}
