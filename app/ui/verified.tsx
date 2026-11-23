import { copy, type Lang } from "../lib/locale";
const graphemes = new Intl.Segmenter();
export function NameWithBadge({ name, lang, size }: { name: string; lang: Lang; size?: number }) {
  const last = graphemes.segment(name).containing(name.length - 1);
  const wordStart = /\S+$/u.exec(name)?.index ?? last?.index ?? 0;
  return <>
    {name.slice(0, wordStart)}
    <span className="verified-name-word">
      {name.slice(wordStart, last?.index)}
      <span className="verified-name-end">{last?.segment}<Verified lang={lang} size={size} /></span>
    </span>
  </>;
}
export function Verified({ lang, size = 19 }: { lang: Lang; size?: number }) {
  return <svg className="verified-badge" width={size} height={size} viewBox="0 0 24 24"
    role="img" aria-label={copy[lang].admin.verified} focusable="false">
    <path fill="#0080ff" d="
      M9.60 2.09 Q12.04 -2.12 14.42 2.12
      L14.87 2.91 Q15.82 4.60 17.72 4.31
      L18.62 4.18 Q23.43 3.46 21.61 7.97
      L21.26 8.81 Q20.54 10.60 21.95 11.91
      L22.62 12.53 Q26.17 15.85 21.51 17.23
      L20.64 17.48 Q18.79 18.03 18.64 19.96
      L18.57 20.86 Q18.20 25.71 14.21 22.93
      L13.47 22.40 Q11.89 21.30 10.29 22.38
      L9.54 22.90 Q5.52 25.63 5.21 20.78
      L5.15 19.87 Q5.03 17.94 3.19 17.37
      L2.32 17.10 Q-2.33 15.66 1.27 12.39
      L1.95 11.78 Q3.38 10.49 2.68 8.69
      L2.35 7.84 Q0.58 3.31 5.38 4.09
      L6.27 4.24 Q8.18 4.55 9.15 2.88 Z" />
    <path d="m7.8 12.5 2.85 2.85 5.55-5.55" fill="none" stroke="#fff"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}
