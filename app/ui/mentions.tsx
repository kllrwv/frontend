"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { api } from "../lib/api";
import { copy, type Lang } from "../lib/locale";
import { profilePath, tagPath } from "../lib/paths";
const mentionPattern = /(?<![\p{L}\p{N}_@-])(@[a-zа-яё0-9_-]{3,54})(?![\p{L}\p{N}_-])/giu;
const fragmentPattern = /(?<![\p{L}\p{N}_@-])@([a-zа-яё0-9_-]{1,54})$/iu;
const fragmentTail = /^[a-zа-яё0-9_-]*/iu;
const hashtagPattern = /(?<![\p{L}\p{N}_#])(#(?:[\p{L}\p{N}_]{1,54}))(?![\p{L}\p{N}_])/gu;
export function LinkedText({ value, linkTags = false }: { value: string; linkTags?: boolean }) {
  const pattern = linkTags ? new RegExp(`${mentionPattern.source}|${hashtagPattern.source}`, "giu") : mentionPattern;
  const pieces = [];
  let offset = 0;
  for (const match of value.matchAll(pattern)) {
    const label = match[0];
    const start = match.index;
    pieces.push(value.slice(offset, start));
    const target = label.toLowerCase();
    if (label.startsWith("#")) {
      pieces.push(<Link key={start} className="inline-hashtag" href={tagPath(target.slice(1))}>{label}</Link>);
    } else {
      pieces.push(<Link key={start} className="inline-mention" href={profilePath(target)}>{label}</Link>);
    }
    offset = start + label.length;
  }
  pieces.push(value.slice(offset));
  return <>{pieces}</>;
}
type Suggestion = { id: string; name: string; username: string };
type Results = { people: Suggestion[] };
export function MentionField({ label, lang, className, name, value, onChange, rows, maxLength, disabled, placeholderOnly = false, autoGrow = false }: {
  label: string; lang: Lang; className: string; name?: string; value: string; onChange: (value: string) => void;
  rows: number; maxLength: number; disabled: boolean; placeholderOnly?: boolean; autoGrow?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLTextAreaElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const [caret, setCaret] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState(0);
  const [results, setResults] = useState<{ term: string; people: Suggestion[] } | null>(null);
  const fragment = caret === null ? null : value.slice(0, caret).match(fragmentPattern);
  const term = disabled || dismissed ? undefined : fragment?.[1].toLowerCase();
  const people = term && results?.term === term ? results.people : [];
  const activeIndex = Math.min(active, Math.max(0, people.length - 1));
  useEffect(() => {
    if (!term) return;
    const request = new AbortController();
    const timer = window.setTimeout(() => {
      api<Results>(`discover?q=${encodeURIComponent(`@${term}`)}`, undefined, request.signal)
        .then(({ people }) => {
          if (!request.signal.aborted) {
            setResults({ term, people: people.slice(0, 6) });
            setActive(0);
          }
        })
        .catch(() => undefined);
    }, 160);
    return () => { window.clearTimeout(timer); request.abort(); };
  }, [term]);
  useLayoutEffect(() => {
    if (pendingCaret.current === null) return;
    input.current?.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = null;
  }, [value]);
  function select(person: Suggestion) {
    if (!fragment || caret === null) return;
    const start = fragment.index ?? caret - fragment[0].length;
    const tail = value.slice(caret);
    const end = caret + (tail.match(fragmentTail)?.[0].length ?? 0);
    const remainder = value.slice(end);
    const mention = `@${person.username}`;
    const replacement = !remainder || /^[\p{L}\p{N}_-]/u.test(remainder) ? `${mention} ` : mention;
    const next = value.slice(0, start) + replacement + remainder;
    if (next.length > maxLength) return;
    const cursor = start + replacement.length;
    input.current?.focus();
    if (next === value) input.current?.setSelectionRange(cursor, cursor);
    else pendingCaret.current = cursor;
    setCaret(cursor);
    setDismissed(true);
    onChange(next);
  }
  function keys(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing || !people.length) return;
    if (event.key === "Escape") {
      event.preventDefault();
      setDismissed(true);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((activeIndex + step + people.length) % people.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      select(people[activeIndex]);
    }
  }
  const textarea = <textarea id={id} ref={input} name={name} value={value} rows={rows} maxLength={maxLength} disabled={disabled}
      placeholder={placeholderOnly ? label : undefined}
      aria-autocomplete="list" aria-controls={people.length ? `${id}-mentions` : undefined}
      aria-activedescendant={people.length ? `${id}-mention-${activeIndex}` : undefined}
      onChange={event => {
        onChange(event.currentTarget.value);
        setCaret(event.currentTarget.selectionStart);
        setDismissed(false);
      }}
      onSelect={event => {
        const { selectionStart, selectionEnd } = event.currentTarget;
        const next = selectionStart === selectionEnd ? selectionStart : null;
        if (next !== caret) {
          setCaret(next);
          setDismissed(false);
        }
      }}
      onKeyDown={keys} onBlur={() => { setCaret(null); setDismissed(false); }} />;
  return <div className={className}>
    <label htmlFor={id} className={placeholderOnly ? "sr-only" : undefined}>{label}</label>
    {autoGrow ? <div className="growing-textarea">
      {textarea}
      <div className="growing-textarea-measure" aria-hidden="true">{value}{" "}</div>
    </div> : textarea}
    {!!people.length && <ul id={`${id}-mentions`} className="mention-suggestions" role="listbox" aria-label={copy[lang].social.mentionSuggestions}>
      {people.map((person, index) => <li key={person.id} id={`${id}-mention-${index}`}
        role="option" aria-selected={index === activeIndex} onMouseDown={event => event.preventDefault()}
        onClick={() => select(person)}>
        <strong>{person.name}</strong><span>@{person.username}</span>
      </li>)}
    </ul>}
  </div>;
}
