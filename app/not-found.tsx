"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { copy, storedLanguage, type Lang } from "./lib/locale";

export default function NotFound() {
  const [lang, setLang] = useState<Lang>("ru");
  useEffect(() => {
    const saved = storedLanguage();
    setLang(saved);
    document.documentElement.lang = saved;
    document.title = copy[saved].notFound;
  }, []);
  const t = copy[lang];
  return <main className="bg-stage">
    <div className="mx-auto flex min-h-svh max-w-3xl flex-col items-start gap-16 px-4 pt-8 pb-16 text-ink">
      <a href="/" className="social-wordmark"><img src="/logo.svg" alt="" width={28} height={28} />{t.feedBrand}</a>
      <section className="grid w-full justify-items-start gap-6 border-0 border-t border-solid border-rule pt-8">
        <h1 className="text-4xl leading-tight font-bold tracking-tight">{t.notFound}</h1>
        <a href="/" className="social-secondary no-underline"><ArrowLeft size={17} aria-hidden="true" />{t.home}</a>
      </section>
    </div>
  </main>;
}
