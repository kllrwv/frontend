"use client";

import Script from "next/script";
import { createContext, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Camera, Check, ChevronLeft, Eye, EyeOff, Radio, Send, UserRound } from "lucide-react";
import { ServiceLinks } from "../legal/links";
import { copy, storedLanguage, type Lang } from "../lib/locale";
import { Wave, type Mode } from "./wave";
import { api, ApiError } from "../lib/api";
import { useResource, type Preferences, type Theme } from "../profile/profile-data";


type Stage = "email" | "telegram" | "totp" | "ready" | "conflict" | "unlinked";
type Flow = {
  kind: Mode;
  stage: Stage;
  email: string | null;
  bot_url: string | null;
  bot_code: string | null;
};
type Profile = {
  username: string | null;
  display_name: string | null;
  bio: string;
  has_avatar: boolean;
};
type BrowserState = { profile: Profile | null; flow: Flow | null };

type Session = {
  profile: Profile & { username: string };
  lang: Lang;
  languagePicker: ReactNode;
  signOut: () => void;
  signingOut: boolean;
  signOutError: string;
  profileSaved: (profile: Profile | null) => void;
  theme: Theme;
  themeChanged: (theme: Theme) => void;
};

const SessionContext = createContext<Session | null>(null);

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("Social pages require a signed-in session");
  return session;
}

export function SessionGate({ children }: { children: ReactNode }) {
  const [sessionCheck, setSessionCheck] = useState<"checking" | "ready" | "failed">("checking");
  const [lang, setLang] = useState<Lang>("ru");
  const [mode, setMode] = useState<Mode | null>(null);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [changedTheme, setChangedTheme] = useState<Theme | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const shell = useRef<HTMLElement>(null);
  const started = useRef(false);
  const canceling = useRef(false);
  const completing = useRef(false);
  const t = copy[lang];
  const username = profile?.username;
  const preferences = useResource<Preferences>(username ? "settings/preferences" : null);

  useEffect(() => {
    if (!username) return;
    function presence() {
      if (document.visibilityState === "visible") void api("profile/presence", {}).catch(() => undefined);
    }
    presence();
    const timer = window.setInterval(presence, 60_000);
    document.addEventListener("visibilitychange", presence);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", presence);
    };
  }, [username]);

  function saveProfile(next: Profile | null) {
    if (next === null) setChangedTheme(null);
    setProfile(next);
  }

  async function restoreSession() {
    setSessionCheck("checking");
    try {
      const state = await api<BrowserState>("me");
      setProfile(state.profile);
      if (state.flow) {
        setFlow(state.flow);
        setMode(state.flow.kind === "register" ? "register" : "login");
      }
      setSessionCheck("ready");
    } catch {
      setSessionCheck("failed");
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    setLang(storedLanguage());
    void restoreSession();
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = copy[lang].brand;
  }, [lang]);

  function language(next: Lang) {
    setLang(next);
    try { localStorage.setItem("killerwave.lang", next); } catch { /* apply for this visit */ }
  }

  async function run(action: () => Promise<void>) {
    setError("");
    setBusy(true);
    try { await action(); }
    catch (failure) { setError(failure instanceof ApiError ? failure.message : "unavailable"); }
    finally { setBusy(false); }
  }

  function switchTo(next: Mode | null) {
    if (busy || completing.current) return;
    if (!flow) {
      setError("");
      setMode(next);
      return;
    }
    canceling.current = true;
    void run(async () => {
      try {
        await api("auth/cancel", {});
        setFlow(null);
        setMode(next);
      } finally { canceling.current = false; }
    });
  }

  useEffect(() => {
    if (flow?.stage !== "ready" && !(flow?.stage === "telegram" && flow.bot_url)) return;
    let mounted = true;
    async function check() {
      if (canceling.current || completing.current) return;
      completing.current = true;
      try {
        const result = await api<{ stage: Stage; bot_needs_code: boolean }>("auth/complete", {});
        if (!mounted) return;
        if (result.stage === "ready") {
          const state = await api<BrowserState>("me");
          if (!mounted) return;
          if (!state.profile) throw new ApiError("unavailable");
          setProfile(state.profile);
          setFlow(null);
          setError("");
          setMode(null);
        } else if (result.stage === "totp") {
          setMode("login");
          setFlow({ kind: "login", stage: "totp", email: null, bot_url: null, bot_code: null });
          setError("");
        } else if (result.stage === "conflict" || result.stage === "unlinked") {
          const stage = result.stage;
          setFlow((active) => active && { ...active, stage });
        } else if (flow?.bot_code && !result.bot_needs_code) {
          setFlow((active) => active && { ...active, bot_code: null });
        }
      } catch (failure) {
        if (!mounted) return;
        const reason = failure instanceof ApiError ? failure.message : "unavailable";
        if (reason === "expired") {
          const state = await api<BrowserState>("me").catch(() => null);
          if (!mounted) return;
          if (state?.profile) {
            setProfile(state.profile);
            setMode(null);
          } else {
            setError(reason);
          }
          setFlow(null);
        } else {
          setError(reason);
        }
      } finally { completing.current = false; }
    }
    const timer = setInterval(check, 2300);
    void check();
    return () => { mounted = false; clearInterval(timer); };
  }, [flow]);

  function credentials(event: FormEvent<HTMLFormElement>, active: Mode) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = String(form.get("identity") || "").trim();
    const password = String(form.get("password") || "");
    const confirmation = String(form.get("confirmation") || "");
    if (!input || !password) return setError("invalid");
    if (active === "register" && password !== confirmation) return setError("password_mismatch");
    void run(async () => {
      setFlow(await api<Flow>("auth/" + active, active === "login"
        ? { login: input, password, lang }
        : { email: input, password, confirmation, lang }));
    });
  }

  function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") || "");
    if (!/^\d{6}$/.test(code)) return setError("code_wrong");
    void run(async () => setFlow(await api<Flow>("auth/email", { code })));
  }

  function verifyAuthenticator(code: string, recovery: boolean) {
    return run(async () => {
      await api("auth/totp", { code, recovery });
      const { profile: account } = await api<BrowserState>("me");
      if (!account) throw new ApiError("unavailable");
      setProfile(account);
      setMode(null);
      setFlow(null);
    });
  }

  function confirmTelegram(idToken: string) {
    return run(async () => {
      const { flow: confirmed } = await api<{ flow: Flow | null }>("auth/telegram/confirm", { id_token: idToken, lang });
      if (confirmed) {
        setFlow(confirmed);
        return;
      }
      const { profile: account } = await api<BrowserState>("me");
      if (!account) throw new ApiError("unavailable");
      setProfile(account);
      setMode(null);
      setFlow(null);
    });
  }

  function startBot(active: Mode) {
    void run(async () => setFlow(await api<Flow>("auth/telegram/bot", { mode: active, lang })));
  }

  function signOut() {
    void run(async () => {
      await api("auth/logout", {});
      saveProfile(null);
      setMode(null);
    });
  }

  const errorText = error ? t.errors[error as keyof typeof t.errors] ?? t.errors.invalid : "";

  function authContent(active: Mode) {
    if (flow?.stage === "totp") return (
      <AuthenticatorLogin lang={lang} busy={busy} error={errorText} clearError={() => setError("")}
        verify={verifyAuthenticator} restart={() => switchTo(active)} />
    );
    if (flow?.stage === "email") return (
      <form onSubmit={verify} noValidate>
        <h1>{t.code}</h1>
        <p>{t.codeHint.replace("{email}", flow.email ?? "")}</p>
        <Field label={t.code}>
          <input className="otp" name="code" autoComplete="one-time-code" inputMode="numeric" maxLength={6} placeholder={t.otpPlaceholder}
            onChange={(event) => { event.currentTarget.value = event.currentTarget.value.replace(/[^0-9]/g, ""); }} />
        </Field>
        <ErrorNote text={errorText} />
        <button className="primary" disabled={busy}>{t.verify}</button>
        <button type="button" className="subtle" onClick={() => switchTo(active)} disabled={busy}>{t.again}</button>
      </form>
    );
    if (flow?.stage === "telegram") return (
      <section>
        <h1>{flow.kind === "register" ? t.pairing : t.telegramLogin}</h1>
        {flow.bot_url ? <>
          <p>{flow.bot_code
            ? (flow.kind === "register" ? t.botRegistrationHint : t.botLoginHint)
            : t.pairingHint}</p>
          {flow.bot_code && <div className="bot-code">{flow.bot_code}</div>}
          <a className="primary" href={flow.bot_url} target="_blank" rel="noopener noreferrer"><Send size={17} />{t.openBot}</a>
          <p className="waiting" role="status"><Radio size={15} />{t.wait}</p>
        </> : <>
          <p>{t.telegramIdentityHint}</p>
          <TelegramButton mode="register" lang={lang} busy={busy} onError={setError} onConfirm={confirmTelegram} onFallback={startBot} />
        </>}
        <ErrorNote text={errorText} />
        <button className="subtle" onClick={() => switchTo(active)} disabled={busy}>{t.again}</button>
      </section>
    );
    if (flow?.stage === "ready") return <section><h1>{t.loading}</h1><ErrorNote text={errorText} /></section>;
    if (flow?.stage === "conflict" || flow?.stage === "unlinked") return (
      <section>
        <h1>{flow.kind === "register" ? t.pairing : t.telegramLogin}</h1>
        <ErrorNote text={t.errors[flow.stage]} />
        <button className="primary" onClick={() => switchTo(flow.stage === "conflict" ? "login" : "register")} disabled={busy}>
          {flow.stage === "conflict" ? t.login : t.register}
        </button>
      </section>
    );
    return (
      <form onSubmit={(event) => credentials(event, active)} noValidate>
        <h1>{t[active]}</h1>
        <Field label={active === "login" ? t.loginLabel : t.email}>
          <input name="identity" type={active === "register" ? "email" : "text"} maxLength={254}
            autoComplete={active === "register" ? "email" : "username"} autoCapitalize="none" spellCheck={false} required />
        </Field>
        <Password label={t.password} autoComplete={active === "login" ? "current-password" : "new-password"}
          hint={active === "register" ? t.passwordHint : undefined} name="password" lang={lang} />
        {active === "register" &&
          <Password label={t.confirmPassword} autoComplete="new-password" name="confirmation" lang={lang} />}
        <ErrorNote text={errorText} />
        <button className="primary" disabled={busy}>{t.send}</button>
        {active === "login" && <>
          <div className="divider"><span>{t.or}</span></div>
          <TelegramButton mode="login" lang={lang} busy={busy} onError={setError} onConfirm={confirmTelegram} onFallback={startBot} />
        </>}
      </form>
    );
  }

  const languagePicker = (
    <div className="language" role="group" aria-label={t.language}>
      {(["ru", "en"] as const).map((choice) => <button key={choice} type="button" lang={choice}
        aria-pressed={lang === choice} onClick={() => language(choice)}>
        {choice === "ru" ? t.ruLabel : t.enLabel}
      </button>)}
    </div>
  );

  if (sessionCheck !== "ready") return (
    <main className="session-gate">
      {sessionCheck === "checking" ? <span className="session-spinner" role="status" aria-label={t.loading} /> : (
        <section>
          <p role="alert">{t.errors.unavailable}</p>
          <button className="subtle" onClick={restoreSession}>{t.social.retry}</button>
        </section>
      )}
    </main>
  );

  if (profile?.username) return (
    <SessionContext.Provider value={{
      profile: { ...profile, username: profile.username }, lang, languagePicker,
      signOut, signingOut: busy, signOutError: errorText, profileSaved: saveProfile,
      theme: changedTheme ?? preferences.data?.theme ?? "dark", themeChanged: setChangedTheme,
    }}>{children}</SessionContext.Provider>
  );

  return (
    <main className={`shell ${profile ? "inside" : ""}`} ref={shell}>
      {!profile && <Wave shell={shell} mode={mode} />}
      <header className="masthead">
        <button className="brand" type="button" aria-label={profile ? t.brand : t.home}
          disabled={!!profile || busy} onClick={() => switchTo(null)}>
          <img className="brand-mark" src="/logo.svg" alt="" width={34} height={34} />
          {t.brand}
        </button>
        {languagePicker}
      </header>
      {profile ? (
        <div className="inside-body">
          <ProfileForm lang={lang} busy={busy} error={errorText} onSignOut={signOut} setError={setError}
            onSave={(form) => void run(async () => setProfile(await api<Profile>("profile", form)))} />
        </div>
      ) : (
        <div className="panels">
          {(["login", "register"] as const).map((option) => {
            return <section className={`panel panel-${option}`} key={option}>
              {mode === option ? (
                <div className="auth-sheet" key={flow?.stage ?? option}>
                  <button className="back subtle" type="button" onClick={() => switchTo(null)} disabled={busy}>
                    <ChevronLeft size={17} />{t.back}
                  </button>
                  {authContent(option)}
                </div>
              ) : (
                <button type="button" className="choice" onClick={() => switchTo(option)} disabled={busy}>
                  <span className="choice-label">{t[option]}</span>
                </button>
              )}
            </section>;
          })}
        </div>
      )}
      <footer className="auth-footer">
        <nav className="language auth-links" aria-label={t.legal.navigation}><ServiceLinks lang={lang} /></nav>
      </footer>
    </main>
  );
}

function AuthenticatorLogin({ lang, busy, error, clearError, verify, restart }: {
  lang: Lang; busy: boolean; error: string; clearError: () => void;
  verify: (code: string, recovery: boolean) => Promise<void>; restart: () => void;
}) {
  const [recovery, setRecovery] = useState(false);
  const t = copy[lang];
  const auth = t.authenticator;
  return <form onSubmit={event => {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") || "");
    void verify(code, recovery);
  }}>
    <h1>{recovery ? auth.recoveryCode : auth.signInTitle}</h1>
    <p>{recovery ? auth.recoverLoginHint : auth.signInHint}</p>
    <Field label={recovery ? auth.recoveryCode : auth.appCode}>
      <input key={String(recovery)} name="code" required disabled={busy} spellCheck={false}
        autoComplete={recovery ? "off" : "one-time-code"} autoCapitalize="none"
        className={recovery ? undefined : "otp"} inputMode={recovery ? "text" : "numeric"}
        pattern={recovery ? undefined : "[0-9]{6}"} maxLength={recovery ? 80 : 6}
        placeholder={recovery ? undefined : t.otpPlaceholder} />
    </Field>
    <ErrorNote text={error} />
    <button className={recovery ? "primary auth-danger" : "primary"} disabled={busy}>
      {recovery ? auth.recoverAndDisconnect : t.verify}
    </button>
    <button type="button" className="subtle" disabled={busy} onClick={() => {
      clearError();
      setRecovery(!recovery);
    }}>{recovery ? auth.useApp : auth.useRecovery}</button>
    <button type="button" className="subtle" onClick={restart} disabled={busy}>{t.again}</button>
  </form>;
}

type TelegramChallenge = { client_id: number; nonce: string };
type TelegramResult = { id_token?: string; error?: string };
type TelegramSdk = {
  auth: (
    options: TelegramChallenge & { lang: Lang; scope: ["profile"] },
    callback: (result: TelegramResult) => void,
  ) => void;
  close: () => void;
};
type TelegramWindow = Window & { Telegram?: { Login?: TelegramSdk } };

function TelegramButton({ mode, lang, busy, onError, onConfirm, onFallback }: {
  mode: Mode;
  lang: Lang;
  busy: boolean;
  onError: (message: string) => void;
  onConfirm: (token: string) => Promise<void>;
  onFallback: (mode: Mode) => void;
}) {
  const [sdkStatus, setSdkStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [challenge, setChallenge] = useState<{ data: TelegramChallenge; validUntil: number } | null>(null);
  const [preparing, setPreparing] = useState(true);
  const [failure, setFailure] = useState("");
  const [attempt, setAttempt] = useState(0);
  const active = useRef(false);
  const request = useRef<{ mode: Mode; attempt: number; promise: Promise<TelegramChallenge> } | null>(null);
  const t = copy[lang];

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      (window as TelegramWindow).Telegram?.Login?.close();
    };
  }, []);

  useEffect(() => {
    let current = true;
    if (window.location.protocol !== "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)) {
      setFailure("telegram_origin");
      setPreparing(false);
      return;
    }
    setPreparing(true);
    setFailure("");
    // Finish the challenge before the click so the browser treats the popup as user-initiated.
    if (request.current?.mode !== mode || request.current.attempt !== attempt) {
      request.current = { mode, attempt, promise: api<TelegramChallenge>("auth/telegram/web", { mode }) };
    }
    request.current.promise
      .then((data) => {
        if (current) setChallenge({ data, validUntil: Date.now() + 9 * 60_000 });
      })
      .catch((error) => {
        if (current) setFailure(error instanceof ApiError ? error.message : "unavailable");
      })
      .finally(() => {
        if (current) setPreparing(false);
      });
    return () => { current = false; };
  }, [mode, attempt]);

  function fallback() {
    (window as TelegramWindow).Telegram?.Login?.close();
    onFallback(mode);
  }

  function open() {
    const sdk = (window as TelegramWindow).Telegram?.Login;
    if (failure || !sdk || sdkStatus !== "ready") {
      fallback();
      return;
    }
    if (!challenge || Date.now() >= challenge.validUntil) {
      onError("expired");
      setAttempt((value) => value + 1);
      return;
    }
    onError("");
    try {
      sdk.close();
      sdk.auth({ ...challenge.data, lang, scope: ["profile"] }, (result) => {
        if (!active.current) return;
        if (!result.id_token) {
          if (result.error === "popup_closed" || result.error === "access_denied") {
            onError("telegram_cancelled");
          } else {
            fallback();
          }
          return;
        }
        setChallenge(null);
        void onConfirm(result.id_token).finally(() => {
          if (active.current) setAttempt((value) => value + 1);
        });
      });
    } catch {
      fallback();
    }
  }

  return <>
    {challenge && <Script src="https://oauth.telegram.org/js/telegram-login.js"
      onReady={() => setSdkStatus("ready")} onError={() => setSdkStatus("failed")} />}
    <button className="secondary telegram-login" type="button" onClick={open}
      disabled={busy || preparing || (sdkStatus === "loading" && !failure)}>
      <span className="telegram-mark"><Send size={16} aria-hidden="true" /></span>
      {mode === "login" ? t.telegramLogin : t.telegramIdentity}
    </button>
    {!failure && sdkStatus !== "failed" &&
      <button className="subtle telegram-fallback" type="button" disabled={busy} onClick={fallback}>
        {mode === "login" ? t.botLogin : t.botRegister}
      </button>}
  </>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="field">
    <span>{label}</span>{children}{hint && <small>{hint}</small>}
  </label>;
}

function Password({ label, hint, name, autoComplete, lang }: {
  label: string; hint?: string; name: string; autoComplete: string; lang: Lang;
}) {
  const [visible, setVisible] = useState(false);
  const toggleLabel = visible ? copy[lang].hidePassword : copy[lang].showPassword;
  return <div className="password">
    <Field label={label} hint={hint}>
      <input name={name} type={visible ? "text" : "password"} autoComplete={autoComplete} maxLength={512} required />
    </Field>
    <button type="button" aria-label={toggleLabel} aria-pressed={visible} onClick={() => setVisible(!visible)}>
      {visible ? <EyeOff size={17} /> : <Eye size={17} />}
    </button>
  </div>;
}

function ErrorNote({ text }: { text: string }) {
  return text ? <p className="error" role="alert">{text}</p> : null;
}

function Avatar({ src }: { src?: string }) {
  return <span className="avatar">{src ? <img alt="" src={src} /> : <UserRound size={31} strokeWidth={1.65} />}</span>;
}

function ProfileForm({ lang, busy, error, setError, onSave, onSignOut }: {
  lang: Lang; busy: boolean; error: string; setError: (value: string) => void;
  onSave: (form: FormData) => void; onSignOut: () => void;
}) {
  const [avatar, setAvatar] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>();
  const t = copy[lang];
  useEffect(() => {
    if (!avatar) { setPreview(undefined); return; }
    const url = URL.createObjectURL(avatar);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatar]);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!String(form.get("name") || "").trim()) return setError("name_invalid");
    if (!/^[A-Za-zА-Яа-яЁё0-9_-]{3,54}$/u.test(String(form.get("username") || ""))) return setError("username_invalid");
    if (avatar) form.set("avatar", avatar);
    onSave(form);
  }

  return <form className="profile-sheet" onSubmit={save} noValidate>
    <h1>{t.profile}</h1>
    <p>{t.profileHint}</p>
    <div className="avatar-editor">
      <Avatar src={preview} />
      <div>
        <label className="upload">
          {preview ? <Check size={16} /> : <Camera size={16} />}{t.avatar}
          <input type="file" accept="image/jpeg,image/png,image/webp" aria-label={t.avatar}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (!file) return;
              if (file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
                setError("avatar_invalid");
                return;
              }
              setError("");
              setAvatar(file);
            }} />
        </label>
        <small>{t.avatarHint}</small>
        {avatar && <button type="button" className="subtle" onClick={() => { setAvatar(null); setError(""); }}>{t.removeAvatar}</button>}
      </div>
    </div>
    <Field label={t.name}><input name="name" maxLength={80} autoComplete="name" required /></Field>
    <Field label={t.username} hint={t.usernameHint}>
      <input name="username" maxLength={54} autoComplete="username" autoCapitalize="none" spellCheck={false} required />
    </Field>
    <Field label={t.bio}><textarea name="bio" maxLength={500} rows={3} placeholder={t.optional} /></Field>
    <ErrorNote text={error} />
    <button className="primary" disabled={busy}>{t.save}</button>
    <button type="button" className="subtle" disabled={busy} onClick={onSignOut}>{t.logout}</button>
  </form>;
}
