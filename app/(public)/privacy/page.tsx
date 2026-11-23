import { LegalDocument, documentLocale, type DocumentProps } from "../../legal/document";
import { copy } from "../../lib/locale";

export async function generateMetadata(props: DocumentProps) {
  const t = copy[await documentLocale(props)];
  return { title: `${t.legal.privacy.title} · ${t.brand}`, description: t.legal.privacy.intro };
}

export default async function PrivacyPage(props: DocumentProps) {
  return <LegalDocument kind="privacy" lang={await documentLocale(props)} />;
}
