"use client";

// Root error fallback for routes outside (site), such as the owner planner. It
// renders inside the root layout, so the page frame is drawn here. The nav is
// left out on purpose: SiteNav reads Instagram stats on the server and cannot
// run inside an error boundary. It never shows or logs what went wrong.
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { cx } from "@/components/types";
import styles from "./error.module.css";

export default function RootError({ retry }: { retry: () => void }) {
  return (
    <div className="mn-page">
      <main className={styles.main}>
        <Card as="section" size="lg" className={styles.card}>
          <span className={cx("mn-label", styles.label)}>Error</span>
          <h1 className={cx("mn-display-lg", styles.title)}>Something broke on my end.</h1>
          <p className="mn-body-lg">
            Not your fault. Try again, and if it keeps happening, the home page still works.
          </p>
          <div className={cx("mn-row", styles.actions)}>
            <Button variant="primary" onClick={() => retry()}>
              Try again
            </Button>
            <Button href="/">Go home</Button>
          </div>
        </Card>
      </main>
    </div>
  );
}
