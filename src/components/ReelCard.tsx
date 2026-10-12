// ReelCard (ReelCard.md, Stats.dc.html): top-reel card. 9:12 inset thumbnail with rank badge
// and a raised views label, then the engagement BarList (compact) and a 2-line caption.
// States: ready (wrapped in <a> when `href` is given), loading (skeletons), empty (the
// "Post more reels" inset slot), thumbError (thumbnail shows "Preview unavailable", numbers stay).
import type { ReactNode } from "react";
import { BarList, type BarItem } from "./BarList";
import { Message, Skeleton } from "./Feedback";
import styles from "./ReelCard.module.css";
import { cx, isExternalHref, type DataState } from "./types";

export type ReelCardProps = {
  state?: "ready" | "loading" | "empty";
  rank?: number;
  /** Display-ready views ("7.7M"). */
  viewsText?: string;
  /** Exact views for the title ("7,700,000 views"). */
  viewsTitle?: string;
  /** Reel URL. Omitted = card is not wrapped in a link. */
  href?: string;
  /** Thumbnail placeholder text ("[REEL 1 THUMBNAIL]"). */
  thumbPlaceholder?: string;
  /** Thumbnail failed to load: "Preview unavailable" in the thumb. */
  thumbError?: boolean;
  /** Engagement bars (Likes / Shares / Saves). */
  engagement?: BarItem[];
  engagementState?: DataState;
  engagementEmptyText?: ReactNode;
  caption?: ReactNode;
  /** Empty-slot copy. */
  emptyText?: ReactNode;
  className?: string;
};

export function ReelCard({
  state = "ready",
  rank,
  viewsText,
  viewsTitle,
  href,
  thumbPlaceholder,
  thumbError = false,
  engagement = [],
  engagementState = "ready",
  engagementEmptyText,
  caption,
  emptyText = "Post more reels to fill this slot.",
  className,
}: ReelCardProps) {
  if (state === "loading") {
    return (
      <div className={cx("mn-reel", className)} aria-busy="true">
        <div className="mn-reel__thumb" />
        <Skeleton className={styles.skelRow} />
        <Skeleton className={styles.skelRow} />
        <Skeleton className={styles.skelRow} />
      </div>
    );
  }

  if (state === "empty") {
    return (
      <div className={cx("mn-card", "mn-card--inset", styles.emptySlot, className)}>
        <Message as="span">{emptyText}</Message>
      </div>
    );
  }

  const body = (
    <>
      <div className="mn-reel__thumb">
        {rank != null ? <span className="mn-reel__rank">{rank}</span> : null}
        <span className="mn-placeholder">{thumbError ? "Preview unavailable" : thumbPlaceholder}</span>
        <div className="mn-reel__views" title={viewsTitle}>
          <span className="mn-label">Views</span>
          <b>{viewsText}</b>
        </div>
      </div>
      <BarList
        variant="compact"
        items={engagement}
        state={engagementState}
        emptyText={engagementEmptyText}
        ariaLabel={`Reel ${rank ?? ""} engagement`.replace(/\s+/g, " ").trim()}
      />
      {caption != null ? <p className="mn-reel__cap">{caption}</p> : null}
    </>
  );

  if (href) {
    return (
      <a
        className={cx("mn-reel", "mn-card--link", className)}
        href={href}
        rel={isExternalHref(href) ? "noopener" : undefined}
      >
        {body}
      </a>
    );
  }
  return <div className={cx("mn-reel", className)}>{body}</div>;
}
