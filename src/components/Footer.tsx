// Footer: the Resume footer, used on every page (decision 3).
// External links carry the arrow-up-right and rel="noopener" (Link.md).
import { Link } from "./Link";
import styles from "./Footer.module.css";

const LINKS = [
  { href: "mailto:masakic@uci.edu", label: "Email" },
  { href: "https://github.com/MasaCTC", label: "GitHub" },
  { href: "https://linkedin.com/in/masakichien", label: "LinkedIn" },
  { href: "https://instagram.com/masamcodes", label: "Instagram" },
] as const;

export function Footer() {
  return (
    <footer className={`mn-row ${styles.footer}`}>
      <span className="mn-mono">© 2026 Masa Chien · Next.js on Vercel</span>
      <div className={`mn-row ${styles.links}`}>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href}>
            {l.label}
          </Link>
        ))}
      </div>
    </footer>
  );
}
