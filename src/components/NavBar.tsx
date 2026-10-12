"use client";
// NavBar (NavBar.md): the site header, dock variant only (decided Oct 11, 2026).
// MC badge (home), the three links (aria-current="page" from the pathname), and the
// follower stat chip. The chip shows "—" until a number is passed (loading).
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import styles from "./NavBar.module.css";
import { cx } from "./types";

const LINKS = [
  { href: "/stats", label: "Stats" },
  { href: "/projects", label: "Projects" },
  { href: "/resume", label: "Resume" },
] as const;

export type NavBarProps = {
  /** Display-ready follower count ("14.1K"). Undefined = loading, chip shows "—". */
  followersText?: string;
  /** Chip label ("14,136 followers. Open stats"). Pass the loading wording when loading. */
  ariaLabel?: string;
};

function isCurrent(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavBar({ followersText, ariaLabel }: NavBarProps) {
  const pathname = usePathname() ?? "/";
  const hasValue = followersText != null && followersText !== "";
  return (
    <nav className="mn-nav mn-nav--dock" aria-label="Main">
      <NextLink className={cx("mn-nav__brand", styles.brand)} href="/" aria-label="Masa Chien, home">
        <span className="mn-nav__mark" aria-hidden="true">
          MC
        </span>
      </NextLink>
      <div className="mn-nav__links">
        {LINKS.map((l) => (
          <NextLink
            key={l.href}
            href={l.href}
            aria-current={isCurrent(pathname, l.href) ? "page" : undefined}
          >
            {l.label}
          </NextLink>
        ))}
      </div>
      <NextLink
        className="mn-nav__stat"
        href="/stats"
        aria-label={ariaLabel}
      >
        {hasValue ? followersText : "—"}
      </NextLink>
    </nav>
  );
}
