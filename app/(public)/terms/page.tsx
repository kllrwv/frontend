import { LegalDocument, documentLocale, type DocumentProps } from "../../legal/document";
import { copy } from "../../lib/locale";

export async function generateMetadata(props: DocumentProps) {
  const t = copy[await documentLocale(props)];
  return { title: `${t.legal.terms.title} · ${t.brand}`, description: t.legal.terms.intro };
}

export default async function TermsPage(props: DocumentProps) {
  return <LegalDocument kind="terms" lang={await documentLocale(props)} />;
}
