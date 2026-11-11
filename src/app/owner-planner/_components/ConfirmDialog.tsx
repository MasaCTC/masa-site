"use client";
// Confirm variant of the Modal (Modal.md "Confirm variant"): every delete in
// the planner asks first. A native <dialog class="mn-modal"> opened with
// showModal(): title, one plain sentence, then "Keep it" (default focus) and
// "Delete" (mn-btn, label in --danger; never red). Escape and a backdrop click
// mean Keep it. On close focus goes back to the opener; after a confirmed
// delete the caller's own focus logic (which runs later) moves it on if the
// opener is gone.
//
// Opened from inside the task modal it stacks on top of it (showModal puts it
// in the top layer and makes the task modal inert); Escape / backdrop only
// close the topmost dialog.
import { useEffect, useId, useRef } from "react";
import { cx } from "@/components/types";
import styles from "../planner.module.css";

type Props = {
  open: boolean;
  /** e.g. `Delete "Essay draft"?` */
  title: string;
  /** One plain sentence on what happens. */
  sentence: string;
  /** Delete pressed. Runs after the dialog has closed (and after onClosed). */
  onConfirm: () => void;
  /** Every close (Keep it, Escape, backdrop, Delete): the owner sets open=false. */
  onClosed: () => void;
};

export function ConfirmDialog({ open, title, sentence, onConfirm, onClosed }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const confirmed = useRef(false);
  const pressedBackdrop = useRef(false);
  const titleId = useId();
  const textId = useId();

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      confirmed.current = false;
      dlg.showModal();
      // React's autoFocus fires before the dialog is open, so focus here too.
      keepRef.current?.focus();
    } else if (!open && dlg.open) {
      dlg.close();
    }
  }, [open]);

  // If it unmounts while open (its owner went away), do not leave the page inert.
  useEffect(() => {
    const dlg = ref.current;
    return () => {
      if (dlg?.open) dlg.close();
    };
  }, []);

  const onClose = (e: React.SyntheticEvent<HTMLDialogElement>) => {
    // React bubbles `close` through the component tree: keep it away from an
    // enclosing dialog (the task modal), which would read it as its own close.
    e.stopPropagation();
    if (e.target !== e.currentTarget) return;
    const el = opener.current;
    const yes = confirmed.current;
    opener.current = null;
    confirmed.current = false;
    // Back to the opener either way; after a delete the owner moves focus on
    // (from onConfirm / its effects) if the opener is about to disappear.
    if (el?.isConnected) el.focus();
    onClosed();
    if (yes) onConfirm();
  };

  return (
    <dialog
      ref={ref}
      className="mn-modal mn-modal--confirm"
      aria-labelledby={titleId}
      aria-describedby={textId}
      onClose={onClose}
      onCancel={(e) => e.stopPropagation()}
      onPointerDown={(e) => {
        pressedBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        e.stopPropagation();
        // A click on the dialog box itself (not its content) is the backdrop,
        // but only if the press started there too (a press inside released
        // outside also clicks the dialog).
        const backdrop = e.target === e.currentTarget && pressedBackdrop.current;
        pressedBackdrop.current = false;
        if (backdrop) e.currentTarget.close();
      }}
    >
      {open ? (
        <div className="mn-modal__in">
          <div className="mn-modal__head">
            <h2 className={cx("mn-heading-sm", styles.confirmTitle)} id={titleId}>
              {title}
            </h2>
          </div>
          <p className="mn-body-sm" id={textId}>
            {sentence}
          </p>
          <div className="mn-row">
            <button
              type="button"
              ref={keepRef}
              className="mn-btn mn-btn--sm"
              autoFocus
              onClick={() => ref.current?.close()}
            >
              Keep it
            </button>
            <button
              type="button"
              className={cx("mn-btn mn-btn--sm", styles.dangerLabel)}
              onClick={() => {
                confirmed.current = true;
                ref.current?.close();
              }}
            >
              Delete
            </button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
