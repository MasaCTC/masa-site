"use client";
// NavBar (NavBar.md): the site header, dock variant only (decided Oct 11, 2026).
// MC badge (home), the three links (aria-current="page" from the pathname), and the
// follower stat chip. The chip shows "—" until a number is passed (loading).
import NextLink from "next/link";
import type { MouseEvent } from "react";
import { usePathname } from "next/navigation";
import { NAV_LINKS } from "@/content/site";
import styles from "./NavBar.module.css";
import { cx } from "./types";
import { useSlidingThumb } from "./useSlidingThumb";

export type NavBarProps = {
  /** Display-ready follower count ("14.1K"). Undefined = loading, chip shows "—". */
  followersText?: string;
  /** Chip label ("14,136 followers. Open stats"). Pass the loading wording when loading. */
  ariaLabel?: string;
};

function isCurrent(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The thumb sits on the 44px badge, not the whole brand link. */
function thumbTarget(el: HTMLElement): HTMLElement {
  return el.matches(".mn-nav__brand") ? (el.querySelector<HTMLElement>(".mn-nav__mark") ?? el) : el;
}

export function NavBar({ followersText, ariaLabel }: NavBarProps) {
  const pathname = usePathname() ?? "/";
  const hasValue = followersText != null && followersText !== "";
  const { containerRef, thumbRef, className: thumbClass, place } = useSlidingThumb<HTMLElement>((nav) => {
    const current = nav.querySelector<HTMLElement>('[aria-current="page"]');
    return current && thumbTarget(current);
  }, pathname);
  // Move the thumb on click so it feels instant; the pathname effect then settles it.
  const onNavClick = (e: MouseEvent<HTMLElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const link = (e.target as HTMLElement).closest<HTMLElement>(".mn-nav__brand, .mn-nav__links a");
    if (link) place(thumbTarget(link));
  };
  return (
    <nav
      ref={containerRef}
      className={cx("mn-nav mn-nav--dock", thumbClass)}
      aria-label="Main"
      onClick={onNavClick}
    >
      <span ref={thumbRef} className="mn-thumb" aria-hidden="true" />
      <NextLink
        className={cx("mn-nav__brand", styles.brand)}
        href="/"
        aria-label="Masa Chien, home"
        aria-current={pathname === "/" ? "page" : undefined}
      >
        <span className="mn-nav__mark" aria-hidden="true">
          MC
        </span>
      </NextLink>
      <div className="mn-nav__links">
        {NAV_LINKS.map((l) => (
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
