"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function Dialog({ title, close, closeLabel, children, wide = false, className = "" }: {
  title: string; close: () => void; closeLabel: string; children: ReactNode; wide?: boolean; className?: string;
}) {
  const element = useRef<HTMLDialogElement>(null);
  const label = useId();
  useEffect(() => {
    const dialog = element.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return <dialog className={`social-dialog ${wide ? "social-dialog-wide" : ""} ${className}`} ref={element}
    aria-labelledby={label} onCancel={(event) => { event.preventDefault(); close(); }}
    onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section>
      <header>
        <h2 id={label}>{title}</h2>
        <button className="icon-action" type="button" aria-label={closeLabel} onClick={close}><X size={20} /></button>
      </header>
      {children}
    </section>
  </dialog>;
}
