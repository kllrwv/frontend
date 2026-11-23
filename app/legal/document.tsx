import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { copy, type Lang } from "../lib/locale";
import { ServiceLinks, type DocumentKind } from "./links";
import "./document.css";
export type DocumentProps = {
  searchParams: Promise<{ lang?: string | string[] }>;
};
type DocumentSection = {
  id: string;
  title: string;
  paragraphs: string[];
  items?: string[];
};
export async function documentLocale({ searchParams }: DocumentProps): Promise<Lang> {
  return (await searchParams).lang === "en" ? "en" : "ru";
}
export function LegalDocument({ kind, lang }: { kind: DocumentKind; lang: Lang }) {
  const site = copy[lang];
  const t = site.legal;
  const page = t[kind];
  const sections: DocumentSection[] = page.sections;
  return <main className="legal-page" lang={lang}>
    <header className="legal-header">
      <Link className="social-wordmark" href="/"><img src="/logo.svg" alt="" width={28} height={28} />{site.brand}</Link>
      <Link className="legal-back" href="/"><ArrowLeft size={16} aria-hidden="true" />{t.back}</Link>
    </header>
    <article aria-labelledby="document-title">
      <header className="legal-intro">
        <h1 id="document-title">{page.title}</h1>
        <p>{page.intro}</p>
        <time dateTime="2026-11-23">{t.updated}</time>
      </header>
      <nav className="legal-contents" aria-labelledby="document-contents">
        <h2 id="document-contents">{t.contents}</h2>
        <ol>
          {sections.map(({ id, title }) => <li key={id}><a href={`#${id}`}>{title}</a></li>)}
        </ol>
      </nav>
      {sections.map(({ id, title, paragraphs, items }, index) => <section key={id} id={id} className="legal-section">
        <h2>{index + 1}. {title}</h2>
        {paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
        {items?.length ? <ul>{items.map(item => <li key={item}>{item}</li>)}</ul> : null}
      </section>)}
    </article>
    <nav className="legal-footer" aria-label={t.navigation}><ServiceLinks lang={lang} current={kind} /></nav>
  </main>;
}
