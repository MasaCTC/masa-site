// ===================== Canvas sync line: SLOT FOR TASK 5 =====================
// The header's sync status ("Syncing Canvas…" with a spinner, then
// "Canvas synced just now · 14 assignments"), from the prototype's #syncLine.
// Task 4 renders the empty live region only; Task 5 (Canvas sync on open)
// fills it. Keep the wrapper: role="status" makes its updates announce.
import { cx } from "@/components/types";
import styles from "../planner.module.css";

export function CanvasSyncLine({ children }: { children?: React.ReactNode }) {
  return (
    <span className={cx("mn-mono mn-row", styles.syncLine)} role="status">
      {children}
    </span>
  );
}
