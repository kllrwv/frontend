import Link from "next/link";
import { copy, type Lang } from "../lib/locale";
export type DocumentKind = "privacy" | "terms";
export function DocumentLinks({ lang, current, onNavigate }: { lang: Lang; current?: DocumentKind; onNavigate?: () => void }) {
  const t = copy[lang].legal;
  const locale = lang === "en" ? "?lang=en" : "";
  return <>
    <Link href={`/privacy${locale}`} aria-current={current === "privacy" ? "page" : undefined} onNavigate={onNavigate}>{t.privacy.title}</Link>
    <Link href={`/terms${locale}`} aria-current={current === "terms" ? "page" : undefined} onNavigate={onNavigate}>{t.terms.title}</Link>
  </>;
}
export function ServiceLinks({ lang, current }: { lang: Lang; current?: DocumentKind }) {
  return <>
    <DocumentLinks lang={lang} current={current} />
    <a href="https://t.me/kllrwvapp" target="_blank" rel="noopener noreferrer">{copy[lang].legal.support}</a>
  </>;
}
