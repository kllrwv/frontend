"use client";
import { useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { copy, type Lang } from "../lib/locale";
import { errorText, type Post } from "../feed/post-data";
import { Dialog } from "./dialog";
type Kind = keyof (typeof copy)[Lang]["admin"]["kinds"];
export type Access = { origin: string | null; moderate: boolean; manage_accounts: boolean };
export type Target = { kind: Kind; id: string; part?: number; title?: string };
export type Mode = "report" | "remove";
export function targetsFor(post: Post, comment = false): Target[] {
  const targets: Target[] = [{ kind: comment ? "comment" : "post", id: post.id }];
  if (post.poll && !post.poll_deleted) targets.push({ kind:"poll", id:post.id });
  for (const item of post.media ?? []) {
    if (!item.deleted) targets.push({ kind:"attachment",id:post.id,part:item.position,title:item.title });
  }
  return targets;
}
export function ContentDialog({ targets, lang, mode, own, close, changed }: {
  targets: Target[]; lang: Lang; mode: Mode; own?: boolean; close: () => void; changed?: () => void;
}) {
  const t=copy[lang].admin;
  const [index,setIndex]=useState(0);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [sent,setSent]=useState(false);
  const title=mode==="report" ? t.fileReport : t.confirmRemove;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data=new FormData(event.currentTarget);
    const target=targets[index];
    if (!target) return;
    setBusy(true); setError("");
    try {
      if (mode==="report") {
        await api("reports",{kind:target.kind,id:target.id,part:target.part,reason:String(data.get("reason")),description:String(data.get("description") ?? "")});
        setSent(true);
      } else {
        await api(own ? `posts/${target.id}/delete` : `mod/${target.kind}/${target.id}/delete`,{part:target.part});
        changed?.();
        close();
      }
    } catch (cause) { setError(errorText(lang,cause)); }
    finally { setBusy(false); }
  }
  return <Dialog title={title} close={close} closeLabel={t.close}>
    {sent ? <><p role="status">{t.reportSent}</p>
      <div className="dialog-actions"><button type="button" className="social-primary" onClick={close}>{t.close}</button></div>
    </> : <form className="settings-form" onSubmit={submit}>
      {targets.length>1 && <label className="content-field">{t.reportKind}
        <select value={index} onChange={event=>setIndex(Number(event.target.value))}>
          {targets.map((target,i)=><option value={i} key={`${target.kind}-${target.part ?? ""}`}>{t.kinds[target.kind]}{target.title ? ` · ${target.title}` : ""}</option>)}
        </select></label>}
      {mode==="report" && <><label className="content-field">{t.reason}<select name="reason">
        {Object.entries(t.reasons).map(([key,label])=><option key={key} value={key}>{label}</option>)}
      </select></label><label className="content-field">{t.description}<textarea name="description" maxLength={1000} rows={3}/></label></>}
      {error && <p className="social-error" role="alert">{error}</p>}
      <div className="dialog-actions">
        <button type="button" className="social-secondary" onClick={close}>{t.cancel}</button>
        <button type="submit" className="social-primary danger-action" disabled={busy}>{mode==="report" ? t.send : t.remove}</button>
      </div>
    </form>}
  </Dialog>;
}
