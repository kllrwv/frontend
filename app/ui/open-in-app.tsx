"use client";
import { ArrowUpRight, X } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { copy, storedLanguage, type Lang } from "../lib/locale";
import { isUsername, isUuid, profileHandle } from "../lib/paths";
const nativeTabs = new Set(["/", "/search", "/notifications", "/privacy", "/terms", "/status"]);
const dismissedKey = "killerwave.open-in-app.dismissed";
function supportsPath(path: string) {
  if (nativeTabs.has(path)) return true;
  const segments = path.split("/").slice(1);
  if (!profileHandle(segments[0] ?? "")) return false;
  return segments.length === 1 || (segments.length === 3 && segments[1] === "post" && isUuid(segments[2]));
}
export function OpenInApp() {
  const path = usePathname();
  const query = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [lang, setLang] = useState<Lang>("ru");
  useEffect(() => {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (!ios) return;
    try { if (sessionStorage.getItem(dismissedKey)) return; } catch {}
    const html = document.documentElement;
    const update = () => setLang(html.lang === "en" ? "en" : storedLanguage());
    update();
    setVisible(true);
    const observer = new MutationObserver(update);
    observer.observe(html, { attributes: true, attributeFilter: ["lang"] });
    return () => observer.disconnect();
  }, []);
  if (!visible || !supportsPath(path)) return null;
  const profile = path === "/" ? query.get("profile") : null;
  if (profile && profile !== "me" && !isUsername(profile.replace(/^@/, ""))) return null;
  const search = query.toString().replace(/\+/g, "%20");
  const strings = copy[query.get("lang") === "en" ? "en" : lang].openInApp;
  function dismiss() {
    setVisible(false);
    try { sessionStorage.setItem(dismissedKey, "1"); } catch {}
  }
  return <aside className="open-in-app">
    <a href={`kllrwv://${path}${search ? `?${search}` : ""}`}>{strings.open}<ArrowUpRight size={16} aria-hidden="true" /></a>
    <button type="button" aria-label={strings.close} onClick={dismiss}><X size={15} aria-hidden="true" /></button>
  </aside>;
}
