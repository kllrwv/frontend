"use client";
import { useEffect, useId, useRef, useState } from "react";
import { DocumentLinks } from "../legal/links";
import { copy, storedLanguage, type Lang } from "../lib/locale";
import "./welcome-dialog.css";
const preferenceKey = "killerwave.welcome";
export function WelcomeDialog() {
  const [step, setStep] = useState<"intro" | "preference" | null>(null);
  const [lang, setLang] = useState<Lang>("ru");
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const open = step !== null;
  useEffect(() => {
    if (location.hostname.startsWith("admin.") || /^\/control(?:\/|$)/.test(location.pathname)) return;
    try { if (localStorage.getItem(preferenceKey) === "hide") return; } catch {}
    const html = document.documentElement;
    const requestedLanguage = new URLSearchParams(location.search).get("lang");
    const updateLanguage = () => setLang(requestedLanguage === "en" || requestedLanguage === "ru" ? requestedLanguage : html.lang === "en" ? "en" : storedLanguage());
    updateLanguage();
    const observer = new MutationObserver(updateLanguage);
    observer.observe(html, { attributes: true, attributeFilter: ["lang"] });
    setStep("intro");
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    element.showModal();
    return () => element.close();
  }, [open]);
  useEffect(() => { if (step) heading.current?.focus(); }, [step]);
  if (!step) return null;
  const strings = copy[lang].welcome;
  const [sourceBefore, sourceAfter] = strings.dataAndSource.split("{github}");
  function save(preference: "show" | "hide") {
    try { localStorage.setItem(preferenceKey, preference); } catch {}
    setStep(null);
  }
  return <dialog className="welcome-dialog" ref={dialog} aria-labelledby={titleId} lang={lang} onCancel={(event) => {
    event.preventDefault();
    setStep(step === "intro" ? "preference" : null);
  }}>
    <div className="welcome-dialog-content">
      <img src="/logo.svg" width="52" height="52" alt="" />
      <h2 id={titleId} ref={heading} tabIndex={-1}>{step === "intro" ? strings.title : strings.prompt}</h2>
      {step === "intro" ? <>
        <div className="welcome-dialog-copy">
          <p>{strings.intro}</p>
          <p>{strings.details}</p>
          <p>{sourceBefore}<a href="https://github.com/kllrwv" target="_blank" rel="noopener noreferrer">{strings.github}</a>{sourceAfter}</p>
        </div>
        <div className="welcome-dialog-links"><DocumentLinks lang={lang} onNavigate={() => setStep(null)} /></div>
        <div className="welcome-dialog-actions"><button className="social-primary" type="button" onClick={() => setStep("preference")}>{strings.close}</button></div>
      </> : <div className="welcome-dialog-actions">
        <button className="social-secondary" type="button" onClick={() => save("show")}>{strings.show}</button>
        <button className="social-primary" type="button" onClick={() => save("hide")}>{strings.hide}</button>
      </div>}
    </div>
  </dialog>;
}
