"use client";

// Error fallback for the (site) routes (Launch.dc.html section 4). The (site)
// layout keeps the nav and footer, so this renders only the card. It never
// shows or logs what went wrong: that stays in the server logs.
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { cx } from "@/components/types";
import styles from "../error.module.css";

export default function SiteError({ retry }: { retry: () => void }) {
  return (
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
  );
}
