"use client";
// Settings (prototype "settings" panel): the Canvas calendar feed. The saved
// link is only ever shown masked (getSettingsMasked / saveCanvasFeed return
// scheme + host + ••••). Save replaces it (and syncs it right away), Remove
// clears it after asking (ConfirmDialog). "Sync now" runs a manual Canvas sync (CanvasSyncLine).
import { useId, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { Message } from "@/components/Feedback";
import { cx } from "@/components/types";
import { saveCanvasFeed } from "@/lib/planner/actions";
import type { SettingsView as Settings } from "@/lib/planner/queries";
import { PLANNER_TZ } from "@/lib/planner/time";
import { fieldError } from "../_lib/errors";
import styles from "../planner.module.css";
import { useCanvasSync } from "./CanvasSyncLine";
import { ConfirmDialog } from "./ConfirmDialog";
import { usePlanner } from "./context";

type Props = { panelId: string; tabId: string; settings: Settings };

function syncedText(at: Date | null): string {
  if (!at) return "not synced yet";
  const d = new Date(at);
  const opts = { timeZone: PLANNER_TZ } as const;
  return `last synced ${d.toLocaleDateString("en-US", { ...opts, month: "short", day: "numeric" })}, ${d.toLocaleTimeString("en-US", { ...opts, hour: "numeric", minute: "2-digit" })}`;
}

export function SettingsView({ panelId, tabId, settings }: Props) {
  const { run } = usePlanner();
  const sync = useCanvasSync();
  const uid = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const removeRef = useRef<HTMLSpanElement>(null);
  const [confirming, setConfirming] = useState(false);
  // What is saved, as far as this page knows (updated from saveCanvasFeed).
  const [saved, setSaved] = useState({
    has: settings.hasFeed,
    masked: settings.feedMasked,
    readable: settings.feedReadable,
  });
  const [editing, setEditing] = useState(!settings.hasFeed);
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "remove" | null>(null);
  const errId = `${uid}-err`;

  const save = (value: string, kind: "save" | "remove") => {
    setUrlError(null);
    setBusy(kind);
    run({
      call: () => saveCanvasFeed({ url: value }),
      success: kind === "save" ? "Canvas link saved." : "Canvas link removed.",
      onOk: (r) => {
        setBusy(null);
        setSaved({ has: r.masked !== null, masked: r.masked, readable: true });
        setUrl("");
        setEditing(r.masked === null);
        if (r.masked !== null) sync.syncNow();
        // Removed: the Remove button is gone, so focus the empty link field.
        else if (kind === "remove") requestAnimationFrame(() => inputRef.current?.focus());
      },
      onFail: (r) => {
        setBusy(null);
        // Remove failed: it was disabled while busy, so put focus back on it.
        if (kind === "remove") requestAnimationFrame(() => removeRef.current?.querySelector("button")?.focus());
        const msg = fieldError(r, "url");
        if (msg) {
          setUrlError(msg);
          inputRef.current?.focus();
          return true;
        }
      },
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      setUrlError("Paste the feed link first.");
      inputRef.current?.focus();
      return;
    }
    save(url, "save");
  };

  return (
    <section id={panelId} role="tabpanel" aria-labelledby={tabId} className={cx("mn-grid", styles.settingsGrid)}>
      <div className={cx("mn-card", styles.gap16)}>
        <h2 className="mn-heading-sm">Canvas import</h2>
        <p className={cx("mn-body-sm", styles.calNote)}>
          Paste your Canvas calendar feed (Canvas → Calendar → Calendar Feed). It syncs every time you open the
          planner, so new assignments are already there. You can still edit or reorder them here. The link is
          stored encrypted and never shown in full.
        </p>

        {saved.has && !saved.readable ? (
          <Message tone="error" detail="The key that protects it may have changed. Paste the link again, or remove it.">
            Couldn&apos;t read the saved Canvas link.
          </Message>
        ) : null}

        {editing ? (
          <form className={styles.modalForm} onSubmit={submit} autoComplete="off" noValidate>
            <div className="mn-field">
              <label className="mn-label" htmlFor={`${uid}-url`}>
                Calendar feed URL
              </label>
              <input
                ref={inputRef}
                className="mn-input mn-input--mono"
                id={`${uid}-url`}
                type="url"
                inputMode="url"
                spellCheck={false}
                placeholder="https://canvas.example.edu/feeds/calendars/user_….ics"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setUrlError(null);
                }}
                aria-invalid={urlError ? true : undefined}
                aria-describedby={urlError ? errId : undefined}
              />
              {urlError ? (
                <span id={errId}>
                  <Message tone="error" as="span">
                    {urlError}
                  </Message>
                </span>
              ) : null}
            </div>
            <div className="mn-row">
              <Button type="submit" loading={busy === "save"} disabled={busy !== null}>
                {busy === "save" ? "Saving…" : "Save link"}
              </Button>
              {saved.has ? (
                <button
                  type="button"
                  className={cx("mn-link", styles.closeLink)}
                  onClick={() => {
                    setEditing(false);
                    setUrl("");
                    setUrlError(null);
                  }}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        ) : (
          <>
            <div className="mn-field">
              <label className="mn-label" htmlFor={`${uid}-masked`}>
                Calendar feed URL
              </label>
              <input
                className="mn-input mn-input--mono"
                id={`${uid}-masked`}
                readOnly
                value={saved.masked ?? "Saved link (can't be shown)"}
              />
            </div>
            <div className="mn-row">
              <Button
                onClick={() => {
                  setEditing(true);
                  requestAnimationFrame(() => inputRef.current?.focus());
                }}
                disabled={busy !== null}
              >
                Replace link
              </Button>
              <span ref={removeRef} className={styles.contents}>
                <Button onClick={() => setConfirming(true)} loading={busy === "remove"} disabled={busy !== null}>
                  {busy === "remove" ? "Removing…" : "Remove"}
                </Button>
              </span>
            </div>
            <ConfirmDialog
              open={confirming}
              title="Remove Canvas feed?"
              sentence="Canvas stops syncing; tasks already imported stay."
              onClosed={() => setConfirming(false)}
              onConfirm={() => save("", "remove")}
            />
          </>
        )}

        {saved.has ? (
          <div className="mn-row">
            <Button onClick={sync.syncNow} loading={sync.pending} disabled={sync.pending || busy !== null}>
              {sync.pending ? "Syncing…" : "Sync now"}
            </Button>
            <span className="mn-mono">
              synced on open ·{" "}
              {sync.phase === "synced"
                ? `${sync.count} upcoming`
                : syncedText(settings.lastSyncedAt)}
            </span>
          </div>
        ) : (
          <span className="mn-mono">No feed connected.</span>
        )}
        <Message>
          Only assignments due today or later come in. They go on the Calendar, not on Today: open one and pick
          &quot;Add to Today&quot; when you want to work on it.
        </Message>
      </div>
    </section>
  );
}
