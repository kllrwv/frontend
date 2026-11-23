import Link from "next/link";
import { copy, type Lang } from "../lib/locale";

export type DocumentKind = "privacy" | "terms";

export function ServiceLinks({ lang, current }: { lang: Lang; current?: DocumentKind }) {
  const t = copy[lang].legal;
  const locale = lang === "en" ? "?lang=en" : "";
  return <>
    <Link href={`/privacy${locale}`} aria-current={current === "privacy" ? "page" : undefined}>{t.privacy.title}</Link>
    <Link href={`/terms${locale}`} aria-current={current === "terms" ? "page" : undefined}>{t.terms.title}</Link>
    <a href="https://t.me/kllrwvapp" target="_blank" rel="noopener noreferrer">{t.support}</a>
  </>;
}
