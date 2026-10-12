"use client";
// Terminal (Terminal.md, Resume.dc.html): command-palette resume. Inset well of mono output,
// a raised `$` input line, and command chips (mono Tags) so nobody has to type.
// Owns the log + input. Commands are data (`responses`), so a server page can render it:
// unknown commands print the danger line, `clear` leaves only the muted hint.
import { useState } from "react";
import styles from "./Terminal.module.css";
import { cx } from "./types";

export type TermLine = {
  text: string;
  tone?: "plain" | "muted" | "ok" | "err" | "prompt";
};

export type TerminalProps = {
  /** Lines shown on first render. */
  initialLog: TermLine[];
  /** Output per command (lower-case key). */
  responses: Record<string, TermLine[]>;
  /** Chip commands, in order. */
  chips: string[];
  /** Hint printed after `clear`. */
  clearHint?: string;
  placeholder?: string;
  className?: string;
};

const toneClass: Record<NonNullable<TermLine["tone"]>, string | undefined> = {
  plain: undefined,
  muted: "mn-term__muted",
  ok: "mn-term__ok",
  err: "mn-term__err",
  prompt: "mn-term__prompt",
};

export function Terminal({
  initialLog,
  responses,
  chips,
  clearHint = "type help, or tap a command",
  placeholder = "type a command, or tap one below",
  className,
}: TerminalProps) {
  const [log, setLog] = useState<TermLine[]>(initialLog);
  const [input, setInput] = useState("");

  const run = (raw: string) => {
    const cmd = raw.trim().toLowerCase();
    setInput("");
    if (cmd === "clear") {
      setLog([{ text: clearHint, tone: "muted" }]);
      return;
    }
    const out: TermLine[] =
      cmd === ""
        ? []
        : (responses[cmd] ?? [{ text: `command not found: ${cmd}. try help`, tone: "err" }]);
    setLog((prev) => [...prev, { text: `$ ${raw}` }, ...out]);
  };

  return (
    <section className={cx("mn-term", styles.term, className)} aria-label="Resume terminal">
      <div className={cx("mn-term__out", styles.out)} role="log" aria-live="polite">
        {log.map((l, i) => (
          <span key={i} className={toneClass[l.tone ?? "plain"]}>
            {l.text}
          </span>
        ))}
      </div>
      <label className="mn-term__line">
        <span className="mn-term__prompt">$</span>
        <input
          aria-label="Command"
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") run(input);
          }}
        />
      </label>
      <div className="mn-term__chips" role="group" aria-label="Commands">
        {chips.map((c) => (
          <button key={c} type="button" className="mn-tag" aria-pressed="false" onClick={() => run(c)}>
            {c}
          </button>
        ))}
      </div>
    </section>
  );
}
