"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Download } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { copy, type Lang } from "../lib/locale";
import { readableError } from "./profile-data";
type Setup = { generation: string; secret: string; uri: string };
type Screen =
  | { kind: "start" }
  | { kind: "setup"; setup: Setup }
  | { kind: "codes"; codes: string[] }
  | { kind: "disable"; recovery: boolean };
export function AuthenticatorSettings({ lang, enabled, reload }: { lang: Lang; enabled: boolean; reload: () => void }) {
  const [screen, setScreen] = useState<Screen | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [downloaded, setDownloaded] = useState(false);
  const t = copy[lang];
  const auth = t.authenticator;
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(readableError(lang, cause));
      if (cause instanceof ApiError && ["totp_enabled", "totp_disabled", "expired"].includes(cause.message)) {
        setScreen(null);
        reload();
      }
    } finally { setBusy(false); }
  }
  function cancel() {
    if (screen?.kind !== "setup") {
      setScreen(null);
      setError("");
      return;
    }
    const { generation } = screen.setup;
    void run(async () => {
      await api("settings/totp/cancel", { generation });
      setScreen(null);
    });
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!screen || busy) return;
    const fields = new FormData(event.currentTarget);
    const password = fields.get("password");
    const code = fields.get("code");
    void run(async () => {
      if (screen.kind === "start") {
        const setup = await api<Setup>("settings/totp/start", { password });
        setScreen({ kind: "setup", setup });
      } else if (screen.kind === "setup") {
        const result = await api<{ recovery_codes: string[] }>("settings/totp/confirm", { generation: screen.setup.generation, code });
        setDownloaded(false);
        setScreen({ kind: "codes", codes: result.recovery_codes });
        reload();
      } else if (screen.kind === "disable") {
        await api("settings/totp/disable", { password, code, recovery: screen.recovery });
        setScreen(null);
        reload();
      }
    });
  }
  function download(codes: string[]) {
    const lines = [auth.recoveryFileTitle, "", ...auth.recoverySaveHint, "", ...codes, ""];
    const file = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = auth.recoveryFileName;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setDownloaded(true);
  }
  const recovery = screen?.kind === "disable" && screen.recovery;
  return <>
    <div className="settings-row">
      <div><strong>{auth.name}</strong><p>{enabled ? auth.enabled : auth.disabled}</p></div>
      <button type="button" className={enabled ? "social-secondary danger-action" : "social-secondary"}
        disabled={screen !== null || busy} onClick={() => {
          setError("");
          setScreen(enabled ? { kind: "disable", recovery: false } : { kind: "start" });
        }}>{enabled ? auth.disconnect : auth.connect}</button>
    </div>
    {screen?.kind === "codes" && <div className="settings-form">
      <strong>{auth.recoveryTitle}</strong>
      <p>{auth.recoverySaveHint.join(" ")}</p>
      <button type="button" className="social-primary" onClick={() => download(screen.codes)}>
        <Download size={17} />{auth.download}
      </button>
      <button type="button" className="social-secondary" disabled={!downloaded} onClick={() => setScreen(null)}>{auth.done}</button>
    </div>}
    {screen && screen.kind !== "codes" && <form className="settings-form" key={screen.kind} onSubmit={submit}>
      {screen.kind !== "setup" && <label className="content-field">{t.profiles.currentPassword}
        <input type="password" name="password" required autoComplete="current-password" maxLength={512} />
      </label>}
      {screen.kind === "setup" && <>
        <p>{auth.scanHint}</p>
        <SetupQr uri={screen.setup.uri} label={auth.qrLabel} />
        <label className="content-field">{auth.manualKey}
          <input className="font-mono" readOnly spellCheck={false} value={screen.setup.secret} onFocus={event => event.currentTarget.select()} />
        </label>
      </>}
      {screen.kind !== "start" && <label className="content-field">{recovery ? auth.recoveryCode : auth.appCode}
        <input key={String(recovery)} name="code" required spellCheck={false} autoCapitalize="none"
          autoComplete={recovery ? "off" : "one-time-code"} inputMode={recovery ? "text" : "numeric"}
          maxLength={recovery ? 80 : 6} pattern={recovery ? undefined : "[0-9]{6}"} />
      </label>}
      {screen.kind === "disable" && <button type="button" className="social-secondary" disabled={busy} onClick={() => {
        setError("");
        setScreen({ kind: "disable", recovery: !recovery });
      }}>{recovery ? auth.useApp : auth.useRecovery}</button>}
      <div className="dialog-actions">
        <button type="button" className="social-secondary" disabled={busy} onClick={cancel}>{t.social.cancel}</button>
        <button className={screen.kind === "disable" ? "social-primary danger-action" : "social-primary"} disabled={busy}>
          {screen.kind === "start" ? auth.continue : screen.kind === "setup" ? auth.connect : auth.disconnect}
        </button>
      </div>
    </form>}
    {error && <p role="alert" className="social-error">{error}</p>}
  </>;
}
function SetupQr({ uri, label }: { uri: string; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const element = canvas.current;
    let active = true;
    void import("qrcode").then(({ toCanvas }) => {
      if (active && element) return toCanvas(element, uri, { width: 206, margin: 4 }).then(() => {
        if (active) setReady(true);
      });
    }).catch(() => {});
    return () => { active = false; };
  }, [uri]);
  return <canvas hidden={!ready} ref={canvas} role="img" aria-label={label}
    className="max-w-full rounded-sm bg-white" />;
}
