// Feedback: the shared loading / empty / error vocabulary (Feedback.md).
// mn-spinner has no display of its own, so it is only rendered inside a flex parent
// (mn-msg, mn-btn).
import type { ReactNode } from "react";
import { ChartIcon, EmptyBoxIcon, ErrorIcon } from "./icons";
import { cx } from "./types";

export function Spinner() {
  return <span className="mn-spinner" aria-hidden />;
}

/** Inset skeleton bar. Size it with a className from a CSS Module (no inline sizes). */
export function Skeleton({ className }: { className?: string }) {
  return <span className={cx("mn-skel", className)} aria-hidden />;
}

export type MessageIcon = "error" | "chart" | "box" | "none";

export type MessageProps = {
  /** info = muted copy (empty states); error = danger + role="alert"; loading = spinner + copy. */
  tone?: "info" | "error" | "loading";
  /** The sentence. For errors this is the bold lead ("Couldn't reach Instagram."). */
  children: ReactNode;
  /** Error only: the plain follow-up sentence rendered in ink inside a span. */
  detail?: ReactNode;
  /** Leading icon. Defaults: error -> error icon, others -> none. */
  icon?: MessageIcon;
  /** Render as div (default) or span (inline rows like the Stats hero status). */
  as?: "div" | "span";
  className?: string;
};

function iconFor(icon: MessageIcon) {
  switch (icon) {
    case "error":
      return <ErrorIcon />;
    case "chart":
      return <ChartIcon />;
    case "box":
      return <EmptyBoxIcon />;
    default:
      return null;
  }
}

export function Message({
  tone = "info",
  children,
  detail,
  icon,
  as: Tag = "div",
  className,
}: MessageProps) {
  const resolvedIcon = icon ?? (tone === "error" ? "error" : "none");
  const isError = tone === "error";
  return (
    <Tag
      className={cx("mn-msg", isError && "mn-msg--error", className)}
      role={isError ? "alert" : undefined}
    >
      {tone === "loading" ? <Spinner /> : iconFor(resolvedIcon)}
      {isError && detail ? (
        <div>
          {children} <span>{detail}</span>
        </div>
      ) : (
        children
      )}
    </Tag>
  );
}
