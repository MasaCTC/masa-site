// Footer: the Resume footer, used on every page (decision 3). Links come from src/content/site.ts.
// The drawn Resume footer has plain mn-link anchors, so external links get no arrow here
// (arrow="none"); rel="noopener" still comes from Link.
import { FOOTER_LINKS, SITE } from "@/content/site";
import { Link } from "./Link";
import styles from "./Footer.module.css";

export function Footer() {
  return (
    <footer className={`mn-row ${styles.footer}`}>
      <span className="mn-mono">{SITE.copyright}</span>
      <div className={`mn-row ${styles.links}`}>
        {FOOTER_LINKS.map((l) => (
          <Link key={l.href} href={l.href} arrow="none">
            {l.label}
          </Link>
        ))}
      </div>
    </footer>
  );
}
