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
export const CONTACT = {
  email: "masakic@uci.edu",
  emailHref: "mailto:masakic@uci.edu",
  github: "https://github.com/MasaCTC",
  linkedin: "https://linkedin.com/in/masakichien",
  instagram: "https://instagram.com/masamcodes",
} as const;

export const FOOTER_LINKS = [
  { href: CONTACT.emailHref, label: "Email" },
  { href: CONTACT.github, label: "GitHub" },
  { href: CONTACT.linkedin, label: "LinkedIn" },
  { href: CONTACT.instagram, label: "Instagram" },
] as const;

/** Home tagline, option 1 (decided). */
export const TAGLINE = "CS at UC Irvine. I build apps in public and post the real numbers.";

/**
 * TODO slots (decision 4). null = the control renders disabled.
 * TODO: set PDF_URL when the resume PDF exists (Download PDF on Home + Resume).
 * TODO: set ONE_BASKET_DEMO_URL when a live One Basket demo is deployed ("Try the live demo").
 */
export const PDF_URL: string | null = null;
export const ONE_BASKET_DEMO_URL: string | null = null;

/** Dock follower chip: "14.2K followers". */
export const NAV_FOLLOWERS_LABEL = "followers";

export const HOME = {
  eyebrow: "@masamcodes · UC Irvine CS",
  rightNow: {
    label: "Right now",
    rows: [
      { text: "Building One Basket", status: "building", statusLabel: "Building" },
      { text: "Building Cofura on a team of three", status: "building", statusLabel: "Building" },
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

/** NEW copy (not from the design): nav chip aria-label while the follower count loads ("—"). */
export const NAV_LOADING_ARIA = "Followers loading. Open stats";

/**
 * Honest wording keyed by source kind. 'manual' is what ships today; 'instagram-api' is the
 * design's original live copy, restored automatically when the Graph API source is wired in.
 * Task 4 picks the set with `INSTAGRAM_COPY[stats.source]`.
 */
export type InstagramCopy = {
  /** Stats hero line under the h1. */
  heroLine: string;
  /** Status label and variant ('neutral' = muted .mn-state, 'live' = green). */
  statusLabel: string;
  statusVariant: "neutral" | "live";
  /** Detail set in <small> right after the label ("Manual · entered by hand · updated …"); empty = the date stays a separate mono line. */
  statusDetail: string;
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
    statusLabel: "Manual",
    statusVariant: "neutral",
    statusDetail: "entered by hand",
    updatedPrefix: "updated",
    sourceNote:
      "Source: entered by hand from Instagram (creator account). Views = reel plays. The Graph API and daily follower snapshots are coming.",
    navAria: (followersExact) => `${followersExact} followers. Open stats`,
  },
  "instagram-api": {
    // Design's original strings (Stats.dc.html / Home / NavBar), restored for the live source.
    heroLine: "Pulled straight from the Instagram API. Not rounded up, not cherry-picked.",
    statusLabel: "Live",
    statusVariant: "live",
    statusDetail: "",
    updatedPrefix: "updated",
    sourceNote:
      "Source: Instagram Graph API (creator account). Views = reel plays. Followers are snapshotted daily for the growth chart.",
    navAria: (followersExact) => `${followersExact} followers, live. Open stats`,
  },
};

/** Stats page static strings from the design (labels, headings, error/empty copy). */
export const STATS_COPY = {
  headlineAria: "Headline numbers",
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
  tileLabels: { followers: "Followers", views: "Total views", interactions: "Interactions" },
  /** Account-level window (account insights). */
  tileMetaWindow: "last 90 days",
  /** Prefix for numbers that mix sources / windows (top reel share). */
  approx: "≈",
  followersGainMeta: "last 30 days",
  viewsCard: { title: "Where the views come from", total: "total", topShareLabel: "Top reel's share", topShareAria: "Top reel's share of all views" },
  engageCard: { title: "How people engage", meta: "last 90 days", meterLabel: "Engagement per view", meterAria: "Engagement rate: interactions per view (likes, comments, shares and saves)" },
  growth: {
    title: "Follower growth",
    ranges: ["30D", "90D", "All"] as const,
    rangesAria: "Range",
    chartAria: "Follower growth chart. Use left and right arrow keys to move between days.",
    // Summary line pieces (design: "10.2K today · +3,114 in 30 days" / "10.2K today · since Sep 7, 2026").
    // Only rendered when a real series exists; with no history the line is omitted.
    today: "today",
    window: { "30D": "in 30 days", "90D": "in 90 days" },
    allSince: "since",
  },
  /** Error / empty tile metas (Stats.dc.html script). */
  asOf: "as of",
  emptyFollowersMeta: "first snapshot",
  emptyTotalsMeta: "no reels yet",
  /** Home chart caption + top reels card (HomeA.dc.html). */
  homeChartLabel: "Follower growth · 90 days",
  homeTopReelsLabel: "Top reels by views",
  homeTopShare: "of all views",
  viewsBarsAria: "Views by reel",
  engageBarsAria: "Likes, shares and saves",
  topReels: { title: "Top 3 reels", meta: "ranked by views", emptySlot: "Post more reels to fill this slot.", scaleNote: "Engagement bars inside each reel share one scale (Reel 1's likes = full bar), so reels can be compared." },
  // NEW copy (not from the design): designed empty states for unknown numbers (decision 5).
  noEngagementYet: "No engagement numbers yet.",
  noReelEngagementYet: "No per-reel numbers yet.",
  meterUnknownReason: "Not entered yet.",
} as const;
