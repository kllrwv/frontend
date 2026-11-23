"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { ChartNoAxesColumn, Check, Plus, X } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { copy, type Lang } from "../lib/locale";

export type PollDraft = { question: string; options: string[]; duration: number | null };
export type Poll = { question: string; ends_at: number | null; closed: boolean; selected: number | null; total: number;
  options: { position: number; label: string; votes: number }[] };
export const initialPoll: PollDraft = { question: "", options: ["", ""], duration: 24 };

export function validPoll(poll: PollDraft) {
  const options = poll.options.map(option => option.trim().toLowerCase());
  return poll.question.trim().length > 0 && options.every(Boolean) && new Set(options).size === options.length;
}

export function PollEditor({ value, onChange, remove, lang, disabled }: {
  value: PollDraft; onChange: (value: PollDraft) => void; remove: () => void; lang: Lang; disabled: boolean;
}) {
  const t = copy[lang].social;
  return <fieldset className="poll-editor" disabled={disabled}>
    <legend>{t.poll}</legend>
    <button type="button" className="icon-action poll-remove" aria-label={t.removePoll} onClick={remove}><X size={17} /></button>
    <label className="content-field">{t.pollQuestion}
      <input value={value.question} maxLength={140} onChange={event => onChange({ ...value, question: event.target.value })} />
    </label>
    <div className="poll-option-fields">
      {value.options.map((option, index) => <div className="poll-editor-option" key={index}>
        <label className="content-field">{t.pollOption.replace("{number}", String(index + 1))}
          <input value={option} maxLength={80} onChange={event => onChange({ ...value,
            options: value.options.map((old, position) => position === index ? event.target.value : old) })} />
        </label>
        {value.options.length > 2 && <button type="button" className="icon-action"
          aria-label={t.removeOption.replace("{number}", String(index + 1))}
          onClick={() => onChange({ ...value, options: value.options.filter((_, position) => position !== index) })}><X size={17} /></button>}
      </div>)}
    </div>
    <div className="poll-editor-footer">
      <label className="content-field">{t.pollDuration}
        <select value={value.duration ?? ""} onChange={event => onChange({ ...value, duration: event.target.value ? Number(event.target.value) : null })}>
          <option value="">{t.pollUnlimited}</option><option value={1}>{t.pollHour}</option><option value={24}>{t.pollDay}</option>
          <option value={72}>{t.pollThreeDays}</option><option value={168}>{t.pollWeek}</option>
        </select>
      </label>
      {value.options.length < 6 && <button type="button" className="social-secondary"
        onClick={() => onChange({ ...value, options: [...value.options, ""] })}><Plus size={16} />{t.addOption}</button>}
    </div>
  </fieldset>;
}

export function PollCard({ id, value, lang, interactive, updated }: {
  id: string; value: Poll; lang: Lang; interactive?: boolean; updated?: (value: Poll) => void;
}) {
  const site = copy[lang];
  const t = site.social;
  const [expired, setExpired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const closed = value.closed || expired;
  const results = closed || value.selected !== null;
  const date = value.ends_at === null ? null : new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeStyle: "short" }).format(value.ends_at * 1000).toLowerCase();

  useEffect(() => {
    if (value.ends_at === null) { setExpired(false); return; }
    const remaining = value.ends_at * 1000 - Date.now();
    setExpired(remaining <= 0);
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => setExpired(true), remaining);
    return () => window.clearTimeout(timer);
  }, [value.ends_at]);

  async function vote(option: number) {
    if (busy || results || !interactive) return;
    setBusy(true);
    setError("");
    try {
      updated?.(await api<Poll>(`posts/${id}/vote`, { option }));
    } catch (cause) {
      const code = cause instanceof ApiError ? cause.message : "unavailable";
      setError(site.errors[code as keyof typeof site.errors] ?? site.errors.unavailable);
      if (code === "poll_closed") setExpired(true);
    } finally { setBusy(false); }
  }

  return <section className="post-poll" aria-label={t.poll}>
    <div className="poll-caption"><ChartNoAxesColumn size={16} aria-hidden="true" />{t.poll}</div>
    <h3>{value.question}</h3>
    {interactive && !results
      ? <div className="poll-choices">{value.options.map(option =>
        <button type="button" key={option.position} onClick={() => void vote(option.position)} disabled={busy}>{option.label}</button>)}</div>
      : <ul className="poll-choices">{value.options.map(option => {
        const percent = value.total ? option.votes / value.total : 0;
        return <li key={option.position} className="poll-result" style={{ "--votes": `${results ? percent * 100 : 0}%` } as CSSProperties}>
          <span>{option.label}{option.position === value.selected && <Check size={17} aria-label={t.pollSelected} />}</span>
          {results && <span className="poll-percentage">{new Intl.NumberFormat(lang, { style: "percent" }).format(percent)}</span>}
        </li>;
      })}</ul>}
    <div className="poll-meta">
      <span>{t.pollVotes.replace("{count}", new Intl.NumberFormat(lang).format(value.total))}</span>
      <span>{closed ? t.pollClosed : date ? t.pollEnds.replace("{date}", date) : t.pollUnlimited}</span>
    </div>
    {error && <p className="social-error" role="alert">{error}</p>}
  </section>;
}
