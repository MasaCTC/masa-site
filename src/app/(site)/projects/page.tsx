// Projects (design/screens/Projects.dc.html). Static server component: all copy from
// src/content/projects.ts. One Basket's demo well follows ONE_BASKET_DEMO_MODE (clip).
import type { Metadata } from "next";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { DemoArea } from "@/components/DemoArea";
import { StatusLabel } from "@/components/StatusLabel";
import { ProgressTrack } from "@/components/ProgressTrack";
import {
  COFURA,
  ONE_BASKET,
  ONE_BASKET_DEMO,
  ONE_BASKET_DEMO_MODE,
  PROJECTS_PAGE,
  PULLPILOT,
} from "@/content/projects";
import { CONTACT } from "@/content/site";
import main from "../main.module.css";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Projects",
};

function OneBasketDemo() {
  switch (ONE_BASKET_DEMO_MODE) {
    case "live": {
      const d = ONE_BASKET_DEMO.live;
      // href null = disabled "Try the live demo" link (decision 4, item 11).
      return <DemoArea mode="live" placeholder={d.placeholder} linkText={d.linkText} href={d.href ?? undefined} deployed={d.deployed} />;
    }
    case "none": {
      const d = ONE_BASKET_DEMO.none;
      return <DemoArea mode="none" shots={[...d.shots]} caption={d.caption} />;
    }
    default: {
      const d = ONE_BASKET_DEMO.clip;
      return <DemoArea mode="clip" poster={d.poster} playLabel={d.playLabel} caption={d.caption} duration={d.duration} />;
    }
  }
}

export default function ProjectsPage() {
  return (
    <main className={main.main}>
      <header className="mn-section__head">
        <div className={styles.headCol}>
          <span className="mn-label">{PROJECTS_PAGE.eyebrow}</span>
          <h1 className="mn-display-lg">{PROJECTS_PAGE.title}</h1>
          <p className="mn-body-lg">{PROJECTS_PAGE.lead}</p>
        </div>
        <Button variant="primary" href={CONTACT.instagram}>
          {PROJECTS_PAGE.cta}
        </Button>
      </header>

      <Card size="lg" className={styles.article}>
        <div className={styles.col}>
          <div className="mn-card__row">
            <h2 className="mn-heading-md">{ONE_BASKET.name}</h2>
            <StatusLabel variant={ONE_BASKET.status}>{ONE_BASKET.statusLabel}</StatusLabel>
          </div>
          <p className="mn-body-lg">{ONE_BASKET.summary}</p>
          <div className={styles.map}>
            <span className="mn-label">{PROJECTS_PAGE.buildMapLabel}</span>
            <ProgressTrack phases={ONE_BASKET.phases} ariaLabel={ONE_BASKET.mapAriaLabel} layout="stack-sm" />
          </div>
        </div>
        <OneBasketDemo />
      </Card>

      <Card size="lg" className={styles.article}>
        <div className={styles.col}>
          <div className="mn-card__row">
            <h2 className="mn-heading-md">{COFURA.name}</h2>
            <StatusLabel variant={COFURA.status}>{COFURA.statusLabel}</StatusLabel>
          </div>
          <p className="mn-body-lg">{COFURA.summary}</p>
          <div className={`mn-meter ${styles.myPart}`}>
            <div className="mn-meter__head">
              <span className="mn-label">{COFURA.myPart.label}</span>
              <span className="mn-meter__value">{COFURA.myPart.value}</span>
            </div>
            <span className="mn-body-sm">{COFURA.myPart.body}</span>
          </div>
          <div className={styles.map}>
            <span className="mn-label">{PROJECTS_PAGE.buildMapLabel}</span>
            <ProgressTrack
              phases={COFURA.phases}
              ariaLabel={COFURA.mapAriaLabel}
              layout="stack-sm"
              note={COFURA.stack}
            />
          </div>
        </div>
        <DemoArea mode="none" shots={[...COFURA.demo.shots]} caption={COFURA.demo.caption} />
      </Card>

      <Card size="lg" variant="dead" className={styles.article}>
        <div className={styles.col}>
          <div className="mn-card__row">
            <h2 className={`mn-heading-sm ${styles.deadTitle}`}>{PULLPILOT.name}</h2>
            <StatusLabel variant={PULLPILOT.status}>{PULLPILOT.statusLabel}</StatusLabel>
          </div>
          <p className="mn-body-lg">{PULLPILOT.summary}</p>
          <ProgressTrack phases={PULLPILOT.phases} ariaLabel={PULLPILOT.mapAriaLabel} />
          <div className="mn-epitaph">
            <span className="mn-label">{PULLPILOT.epitaph.label}</span>
            <p>{PULLPILOT.epitaph.body}</p>
            <p className="mn-body-sm">{PULLPILOT.epitaph.aside}</p>
          </div>
        </div>
        <DemoArea mode="none" shots={[...PULLPILOT.shots]} caption={PULLPILOT.demoCaption} />
      </Card>
    </main>
  );
}
