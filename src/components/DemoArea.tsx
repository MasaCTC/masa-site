// DemoArea (DemoArea.md, Projects.dc.html): the inset well on a project card.
// Modes: live (preview frame + "Try the live demo" link + optional Live label),
// clip (poster frame + raised play button + clip length), none (up to three real phone
// screenshots + optional caption; never placeholder slots), message (the "nothing to show yet" well).
// States: loading (frame as a 16:10 skeleton), error (danger message in the frame, then the
// screenshot fallback when `shots` are given), empty (the same "nothing to show" well as
// mode="message", with `emptyText`).
import Image from "next/image";
import type { ReactNode } from "react";
import { Message, Skeleton } from "./Feedback";
import { Link } from "./Link";
import { StatusLabel } from "./StatusLabel";
import { PlayIcon } from "./icons";
import styles from "./DemoArea.module.css";
import { cx, type DataState } from "./types";

export type DemoAreaProps =
  | (DemoBase & {
      mode: "live";
      /** Placeholder text in the frame (shown until a real preview exists). */
      placeholder: string;
      /** Demo URL. Omitted = link renders disabled (decision 4). */
      href?: string;
      linkText?: string;
      /** Show the Live status label (deployed). */
      deployed?: boolean;
    })
  | (DemoBase & {
      mode: "clip";
      /** Poster placeholder text. */
      poster: string;
      /** Play button label ("Play 0:24 clip: a recipe becomes a basket"). */
      playLabel: string;
      caption: ReactNode;
      /** Clip length ("0:24"). */
      duration: string;
    })
  | (DemoBase & {
      mode: "none";
      /** Up to three real screenshots. */
      shots: Shot[];
      caption?: ReactNode;
    })
  | (DemoBase & {
      mode: "message";
      message: ReactNode;
    });

type DemoBase = {
  state?: DataState;
  /** Copy for state="empty" (rendered as the message well). */
  emptyText?: ReactNode;
  errorText?: ReactNode;
  /** Error fallback screenshots (shown under the error frame). */
  fallbackShots?: Shot[];
  className?: string;
};

/** A real screenshot: image path (public/ or remote allowed by next.config) + alt text. */
export type Shot = { src: string; alt: string };

function Shots({ shots }: { shots: Shot[] }) {
  return (
    <div className="mn-demo__shots">
      {shots.slice(0, 3).map((s) => (
        <div key={s.src} className={cx("mn-demo__shot", styles.shot)}>
          <Image src={s.src} alt={s.alt} fill sizes="(max-width: 640px) 33vw, 180px" className={styles.shotImg} />
        </div>
      ))}
    </div>
  );
}

export function DemoArea(props: DemoAreaProps) {
  const { state = "ready", className } = props;

  if (state === "loading") {
    return (
      <div className={cx("mn-demo", className)} aria-busy="true">
        <Skeleton className={styles.skelMedia} />
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className={cx("mn-demo", className)}>
        <div className="mn-demo__media">
          <Message tone="error" as="span" className={styles.errorMsg}>
            {props.errorText ?? "Clip didn't load."}
          </Message>
        </div>
        {props.fallbackShots?.length ? <Shots shots={props.fallbackShots} /> : null}
      </div>
    );
  }

  if (state === "empty") {
    return (
      <div className={cx("mn-demo", styles.messageWell, className)}>
        <Message icon="box" className={styles.messagePad}>
          {props.emptyText ?? "Nothing to show yet."}
        </Message>
      </div>
    );
  }

  switch (props.mode) {
    case "live":
      return (
        <div className={cx("mn-demo", className)}>
          <div className="mn-demo__media">
            <span className="mn-placeholder">{props.placeholder}</span>
          </div>
          <div className="mn-demo__bar">
            <Link href={props.href} arrow="external" disabled={!props.href}>
              {props.linkText ?? "Try the live demo"}
            </Link>
            {props.deployed ? <StatusLabel variant="live">Live</StatusLabel> : null}
          </div>
        </div>
      );
    case "clip":
      return (
        <div className={cx("mn-demo", className)}>
          <div className="mn-demo__media">
            <span className={cx("mn-placeholder", styles.poster)}>{props.poster}</span>
            <button
              type="button"
              className={cx("mn-btn", "mn-btn--icon", styles.play)}
              aria-label={props.playLabel}
            >
              <PlayIcon />
            </button>
          </div>
          <div className="mn-demo__bar">
            <span className="mn-body-sm">{props.caption}</span>
            <span className="mn-mono">{props.duration}</span>
          </div>
        </div>
      );
    case "none":
      return (
        <div className={cx("mn-demo", className)}>
          <Shots shots={props.shots} />
          {props.caption ? <p className="mn-body-sm">{props.caption}</p> : null}
        </div>
      );
    case "message":
      return (
        <div className={cx("mn-demo", styles.messageWell, className)}>
          <Message icon="box" className={styles.messagePad}>
            {props.message}
          </Message>
        </div>
      );
  }
}
