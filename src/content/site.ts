// Site-wide content: nav, footer, contact, copy, and the TODO URL slots.
// Strings are copied exactly from design/screens/*.dc.html unless flagged NEW.
import type { SourceKind } from "@/lib/instagram/types";

export const SITE = {
  name: "Masa Chien",
  handle: "@masamcodes",
  copyright: "© 2026 Masa Chien · Next.js on Vercel",
} as const;

export const NAV_LINKS = [
  { href: "/stats", label: "Stats" },
  { href: "/projects", label: "Projects" },
  { href: "/resume", label: "Resume" },
] as const;

/** Resume footer, used on every page (decision 3). */
export const FOOTER_LINKS = [
  { href: "mailto:masakic@uci.edu", label: "Email" },
  { href: "https://github.com/MasaCTC", label: "GitHub" },
  { href: "https://linkedin.com/in/masakichien", label: "LinkedIn" },
  { href: "https://instagram.com/masamcodes", label: "Instagram" },
] as const;

export const CONTACT = {
  email: "masakic@uci.edu",
  emailHref: "mailto:masakic@uci.edu",
  github: "https://github.com/MasaCTC",
  linkedin: "https://linkedin.com/in/masakichien",
  instagram: "https://instagram.com/masamcodes",
} as const;

/** Home tagline, option 1 (decided). */
export const TAGLINE = "CS at UC Irvine. I build apps in public and post the real numbers.";

/**
 * TODO slots (decision 4). null = the control renders disabled.
 * TODO: set PDF_URL when the resume PDF exists (Download PDF on Home + Resume).
 * TODO: set ONE_BASKET_DEMO_URL when a live One Basket demo is deployed ("Try the live demo").
 */
export const PDF_URL: string | null = null;
export const ONE_BASKET_DEMO_URL: string | null = null;

export const HOME = {
  eyebrow: "@masamcodes · UC Irvine CS",
  rightNow: {
    label: "Right now",
    rows: [
      { text: "Building One Basket", pill: "building", pillLabel: "Building" },
      { text: "Scoping a sector scanner", pill: "scoping", pillLabel: "Scoping" },
      { text: "CS at UCI, graduating early", mono: "Mar 2028" },
    ],
  },
  statsHeading: "Instagram, in numbers",
  statsLink: "See all stats",
  buildingHeading: "What I'm building",
  buildingLink: "All projects",
  resume: {
    label: "Resume",
    heading: "B.S. Computer Science, UC Irvine",
    body: "Expected March 2028. Cofura, One Basket, RetroLink, Dungeon Dilemma, and three jobs before that.",
    degreeMeterLabel: "Degree progress",
    degreeMeta: "13 of 30 months · done Mar 2028",
    open: "Open resume",
    download: "Download PDF",
  },
} as const;

/**
 * Honest wording keyed by source kind. 'manual' is what ships today; 'instagram-api' is the
 * design's original live copy, restored automatically when the Graph API source is wired in.
 * Task 4 picks the set with `INSTAGRAM_COPY[stats.source]`.
 */
export type InstagramCopy = {
  /** Stats hero line under the h1. */
  heroLine: string;
  /** Status pill label and variant ('neutral' = plain mn-pill, 'live' = green). */
  pillLabel: string;
  pillVariant: "neutral" | "live";
  /** Prefix before the pull date: `${updatedPrefix} ${formatPulledDate(pulledAt)}`. */
  updatedPrefix: string;
  /** Footer source note on /stats. */
  sourceNote: string;
  /** NavBar chip aria-label, given the exact follower string ("14,136"). */
  navAria: (followersExact: string) => string;
};

export const INSTAGRAM_COPY: Record<SourceKind, InstagramCopy> = {
  manual: {
    // NEW copy (not from the design): honest manual wording per decision 5.
    heroLine:
      "These numbers are entered by hand from Instagram until the API is connected. Not rounded up, not cherry-picked.",
    pillLabel: "Manual",
    pillVariant: "neutral",
    updatedPrefix: "updated",
    sourceNote:
      "Source: entered by hand from Instagram (creator account). Views = reel plays. The Graph API and daily follower snapshots are coming.",
    navAria: (followersExact) => `${followersExact} followers. Open stats`,
  },
  "instagram-api": {
    // Design's original strings (Stats.dc.html / Home / NavBar), restored for the live source.
    heroLine: "Pulled straight from the Instagram API. Not rounded up, not cherry-picked.",
    pillLabel: "Live",
    pillVariant: "live",
    updatedPrefix: "updated",
    sourceNote:
      "Source: Instagram Graph API (creator account). Views = reel plays. Followers are snapshotted daily for the growth chart.",
    navAria: (followersExact) => `${followersExact} followers, live. Open stats`,
  },
};

/** Stats page static strings from the design (labels, headings, error/empty copy). */
export const STATS_COPY = {
  title: "Instagram, in numbers",
  eyebrow: "@masamcodes",
  follow: "Follow @masamcodes",
  loadingHeadline: "Pulling from Instagram…",
  loadingChart: "Pulling follower history…",
  staleLabel: "Stale",
  staleMeta: "last good pull",
  newLabel: "New",
  newMeta: "first pull",
  errorBanner: "Couldn't reach Instagram.",
  errorBannerDetail: "The numbers below are from the last good pull,",
  retry: "Try again",
  chartErrorTitle: "Couldn't load follower history.",
  chartErrorDetail: "Daily snapshots resume on the next pull.",
  chartEmpty: "Not enough history yet. Growth shows after 2 days of snapshots.",
  tileLabels: { followers: "Followers", views: "Total views", likes: "Total likes", shares: "Total shares" },
  tileMetaAll: "across all reels",
  followersGainMeta: "last 30 days",
  homeViewsMeta: "across all reels · last 90 days shown",
  likesSharesLabel: "Likes · shares",
  viewsCard: { title: "Where the views come from", total: "total", topShareLabel: "Top reel's share", topShareAria: "Top reel's share of all views" },
  engageCard: { title: "How people engage", meta: "all reels", meterLabel: "Engagement per view", meterAria: "Engagement rate: likes, shares and saves per view" },
  growth: { title: "Follower growth", ranges: ["30D", "90D", "All"] as const, chartAria: "Follower growth chart. Use left and right arrow keys to move between days." },
  topReels: { title: "Top 3 reels", meta: "ranked by views", emptySlot: "Post more reels to fill this slot.", scaleNote: "Engagement bars inside each reel share one scale (Reel 1's likes = full bar), so reels can be compared." },
  allOthersTitle: "Every other reel combined",
  // NEW copy (not from the design): designed empty states for unknown numbers (decision 5).
  noEngagementYet: "No engagement numbers yet.",
  noReelEngagementYet: "No per-reel numbers yet.",
  meterUnknownReason: "Not entered yet.",
} as const;
