"use client";
import { useEffect, useState } from "react";
import { Activity, RotateCw } from "lucide-react";
import { api } from "../lib/api";
import { copy, storedLanguage, type Lang } from "../lib/locale";
const SERVICES = ["database", "auth", "feed", "media"] as const;
type Service = typeof SERVICES[number];
type Health = "ok" | "slow" | "down" | "unknown";
type Sample = { service: Service; minute: number; state: Exclude<Health, "unknown"> };
type Status = { minute: number; current: Sample[]; history: Sample[] };
const WEIGHT: Record<Health, number> = { unknown: 0, ok: 1, slow: 2, down: 3 };
export default function StatusPage() {
  const [lang, setLang] = useState<Lang>("ru");
  const [status, setStatus] = useState<Status | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const site = copy[lang];
  const t = site.social;
  useEffect(() => { setLang(storedLanguage()); }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = `${t.status} · ${site.brand}`;
  }, [lang, t.status, site.brand]);
  useEffect(() => {
    let request: AbortController | null = null;
    function load() {
      request?.abort();
      const next = new AbortController();
      request = next;
      setLoading(true);
      api<Status>("status", undefined, next.signal).then((value) => {
        if (next.signal.aborted) return;
        setStatus(value);
        setUnreachable(false);
      }).catch(() => { if (!next.signal.aborted) setUnreachable(true); })
        .finally(() => { if (!next.signal.aborted) setLoading(false); });
    }
    load();
    const timer = window.setInterval(load, 60_000);
    return () => { window.clearInterval(timer); request?.abort(); };
  }, [refresh]);
  const worst = status?.current.reduce<Health>((state, item) =>
    WEIGHT[item.state] > WEIGHT[state] ? item.state : state, "unknown");
  const state: Health = unreachable ? "down" : worst ?? "unknown";
  const headline = unreachable ? t.statusUnavailable : !status ? site.loading : state === "ok" ? t.statusHealthy : t.statusIssue;
  const datetime = new Intl.DateTimeFormat(lang, { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });
  const percentage = new Intl.NumberFormat(lang, { style: "percent", maximumFractionDigits: 1 });
  const now = status?.minute;
  const buckets = 48;
  return <main className="status-shell">
    <header className="status-header">
      <a href="/" className="social-wordmark"><img src="/logo.svg" alt="" width={27} height={27} />{site.feedBrand}</a>
      <button type="button" className="icon-action" title={t.refreshStatus} aria-label={t.refreshStatus} disabled={loading}
        onClick={() => setRefresh((value) => value + 1)}><RotateCw size={18} /></button>
    </header>
    <section className="status-overview" aria-live="polite">
      <div className="status-overview-meta">
        <span><Activity size={17} aria-hidden="true" />{t.status}</span>
        <span>{status ? t.checked.replace("{time}", datetime.format(status.minute * 60_000).toLowerCase()) : t.statusScope}</span>
      </div>
      <h1><span className={`state-dot state-${state}`} aria-hidden="true" />{headline}</h1>
    </section>
    <section className="status-history" aria-labelledby="status-period">
      <h2 id="status-period">{t.period}</h2>
      {SERVICES.map((service) => {
        const name = service === "feed" ? t.feedService : t[service];
        const samples = status?.history.filter((sample) => sample.service === service) ?? [];
        const current = status?.current.find((sample) => sample.service === service);
        const slots: Health[] = Array.from({ length: buckets }, () => "unknown");
        for (const sample of [...samples, ...(current ? [current] : [])]) {
          if (now === undefined) continue;
          const index = buckets - 1 - Math.floor((now - sample.minute) / 30);
          if (index >= 0 && index < buckets && WEIGHT[sample.state] > WEIGHT[slots[index]]) slots[index] = sample.state;
        }
        const currentLabel = unreachable ? t.unknown : t[current?.state ?? "unknown"];
        const availability = samples.length
          ? percentage.format(samples.filter((sample) => sample.state !== "down").length / samples.length)
          : null;
        return <article className="status-service" key={service}>
          <header>
            <div>
              <h3>{name}</h3>
              <span className="status-service-state">
                <i className={`state-dot state-${unreachable ? "unknown" : current?.state ?? "unknown"}`} aria-hidden="true" />
                {currentLabel}
              </span>
            </div>
            {availability && <span className="status-availability" aria-label={`${t.availability} ${availability}`} title={t.availability}>{availability}</span>}
          </header>
          <div className="status-meter" aria-hidden="true">
            {slots.map((slot, index) => <span key={index} className={`state-${slot}`}
              title={now === undefined ? t[slot] : `${datetime.format((now - (buckets - 1 - index) * 30) * 60_000).toLowerCase()} · ${t[slot]}`} />)}
          </div>
        </article>;
      })}
      <div className="status-axis"><span>{t.hoursAgo}</span><span>{t.now}</span></div>
    </section>
    <footer className="status-legend">
      {(["ok", "slow", "down", "unknown"] as const).map((key) => <span key={key}>
        <i className={`state-dot state-${key}`} aria-hidden="true" />{t[key]}
      </span>)}
    </footer>
  </main>;
}
