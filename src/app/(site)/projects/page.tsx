// Projects (design/screens/Projects.dc.html + Launch.dc.html section 5). Static server component:
// all copy from src/content/projects.ts. A card is two columns only when it has something real on
// the right (the TestFlight beta block or real screenshots); otherwise it is one column with no
// screenshot area. The header count is derived from the project statuses.
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Button } from "@/components/Button";
import { Card, type CardProps } from "@/components/Card";
import { DemoArea } from "@/components/DemoArea";
import { ArrowUpRightIcon, PhoneIcon } from "@/components/icons";
import { StatusLabel } from "@/components/StatusLabel";
import { ProgressTrack } from "@/components/ProgressTrack";
import { COFURA, ONE_BASKET, PROJECTS_PAGE, PULLPILOT, hasSidePanel, type Shot } from "@/content/projects";
import { CONTACT } from "@/content/site";
import main from "../main.module.css";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Projects",
};

/** Project card: two columns with a right-hand panel, or a single 22px-gap column. */
function ProjectCard({
  variant,
  side,
  children,
}: {
  variant?: CardProps["variant"];
  side: ReactNode;
  children: ReactNode;
}) {
  if (side) {
    return (
      <Card size="lg" variant={variant} className={styles.article}>
        <div className={styles.col}>{children}</div>
        {side}
      </Card>
    );
  }
  return (
    <Card size="lg" variant={variant} className={styles.single}>
      {children}
    </Card>
  );
}

type Beta = typeof COFURA.beta;

/** Right-hand panel: the beta block and/or real screenshots; null = one-column card. */
function sidePanel(p: { shots: readonly Shot[]; beta?: Beta }): ReactNode {
  if (!hasSidePanel(p)) return null;
  const beta = p.beta ? <BetaBlock beta={p.beta} /> : null;
  const shots = p.shots.length > 0 ? <DemoArea mode="none" shots={[...p.shots]} /> : null;
  return beta && shots ? (
    <div className={styles.col}>
      {beta}
      {shots}
    </div>
  ) : (
    (beta ?? shots)
  );
}

/** Launch.dc.html TestFlight block (.lb-beta) in the demo well. */
function BetaBlock({ beta }: { beta: Beta }) {
  return (
    <div className="mn-demo">
      <div className={styles.beta}>
        <div className={styles.betaIcon} aria-hidden="true">
          <PhoneIcon />
        </div>
        <span className="mn-label">{beta.label}</span>
        <h3 className="mn-heading-sm">{beta.heading}</h3>
        <p className={`mn-body-sm ${styles.betaBody}`}>{beta.body}</p>
        <a className="mn-btn" href={beta.href} target="_blank" rel="noopener">
          {beta.linkText}
          <ArrowUpRightIcon />
        </a>
        <span className="mn-mono">{beta.note}</span>
      </div>
    </div>
  );
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

      <ProjectCard variant="paused" side={sidePanel(ONE_BASKET)}>
        <div className="mn-card__row">
          <h2 className="mn-heading-md">{ONE_BASKET.name}</h2>
          <StatusLabel variant={ONE_BASKET.status}>{ONE_BASKET.statusLabel}</StatusLabel>
        </div>
        <p className="mn-body-lg">{ONE_BASKET.summary}</p>
        <div className={`${styles.map} ${styles.narrow}`}>
          <span className="mn-label">{ONE_BASKET.mapLabel}</span>
          <ProgressTrack phases={ONE_BASKET.phases} ariaLabel={ONE_BASKET.mapAriaLabel} layout="stack-sm" />
        </div>
        <div className={`mn-epitaph ${styles.narrow}`}>
          <span className="mn-label">{ONE_BASKET.epitaph.label}</span>
          <p>{ONE_BASKET.epitaph.body}</p>
        </div>
      </ProjectCard>

      <ProjectCard side={sidePanel(COFURA)}>
        <div className="mn-card__row">
          <h2 className="mn-heading-md">{COFURA.name}</h2>
          <StatusLabel variant={COFURA.status} detail={COFURA.statusDetail}>
            {COFURA.statusLabel}
          </StatusLabel>
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
          <span className="mn-label">{COFURA.mapLabel}</span>
          <ProgressTrack phases={COFURA.phases} ariaLabel={COFURA.mapAriaLabel} layout="stack-sm" note={COFURA.stack} />
        </div>
      </ProjectCard>

      <ProjectCard variant="dead" side={sidePanel(PULLPILOT)}>
        <div className="mn-card__row">
          <h2 className={`mn-heading-sm ${styles.deadTitle}`}>{PULLPILOT.name}</h2>
          <StatusLabel variant={PULLPILOT.status}>{PULLPILOT.statusLabel}</StatusLabel>
        </div>
        <p className="mn-body-lg">{PULLPILOT.summary}</p>
        <ProgressTrack phases={PULLPILOT.phases} ariaLabel={PULLPILOT.mapAriaLabel} className={styles.narrow} />
        <div className={`mn-epitaph ${styles.narrow}`}>
          <span className="mn-label">{PULLPILOT.epitaph.label}</span>
          <p>{PULLPILOT.epitaph.body}</p>
          <p className="mn-body-sm">{PULLPILOT.epitaph.aside}</p>
        </div>
      </ProjectCard>
    </main>
  );
}
