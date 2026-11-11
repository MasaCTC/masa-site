// The 404 page (Launch.dc.html section 3). Root-level so it handles every
// unmatched URL, including a signed-out /planner (see src/proxy.ts), which must
// look exactly like any other missing page. It sits outside (site), so it draws
// the site frame (mn-page, nav, footer) itself.
//
// Must stay prerenderable: an uncached read here would make it stream, and a
// streamed not-found is sent with status 200. SiteNav's Instagram read is
// "use cache", so this prerenders (the build shows /_not-found as static).
import type { Metadata } from "next";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Footer } from "@/components/Footer";
import { SiteNav } from "@/components/SiteNav";
import { cx } from "@/components/types";
import main from "./(site)/main.module.css";
import styles from "./not-found.module.css";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <div className="mn-page">
      <SiteNav />
      <main className={main.main}>
        <Card as="section" size="lg" className={styles.card}>
          <span className="mn-label">404 · page not found</span>
          <h1 className={cx("mn-display-lg", styles.title)}>Nothing here.</h1>
          <p className="mn-body-lg">
            This page doesn&apos;t exist, or it moved. The real stuff is one click away.
          </p>
          <div className={cx("mn-row", styles.actions)}>
            <Button variant="primary" href="/">
              Go home
            </Button>
            <Button href="/stats">Stats</Button>
            <Button variant="ghost" href="/projects">
              Projects
            </Button>
          </div>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
