// Projects content, copied from design/screens/Projects.dc.html and the Home
// "What I'm building" cards. Types map onto src/components props (ProgressTrack, DemoArea, Pill).
import type { Phase } from "@/components/ProgressTrack";
import { ONE_BASKET_DEMO_URL } from "./site";

export type ProjectStatus = "building" | "scoping" | "dead";

export const PROJECTS_PAGE = {
  eyebrow: "2 building · 1 dead",
  title: "Projects",
  lead: "What I'm building, where each one actually is, and one that didn't make it.",
  cta: "Follow the build",
  buildMapLabel: "Build map",
} as const;

/** One Basket demo modes (DemoArea). Default is 'clip' (controller ruling). */
export type OneBasketDemoMode = "clip" | "live" | "none";
export const ONE_BASKET_DEMO_MODE: OneBasketDemoMode = "clip";

export const ONE_BASKET_DEMO = {
  clip: {
    poster: "[CLIP POSTER]",
    playLabel: "Play 0:24 clip: a recipe becomes a basket",
    caption: "Vertical slice: paste a recipe, get a basket",
    duration: "0:24",
  },
  live: {
    placeholder: "[ONE BASKET SCREENSHOT]",
    linkText: "Try the live demo",
    /** TODO: ONE_BASKET_DEMO_URL in site.ts. null = disabled link (decision 4). */
    href: ONE_BASKET_DEMO_URL,
    deployed: true,
  },
  none: {
    shots: ["[SCREEN 1]", "[SCREEN 2]", "[SCREEN 3]"],
    caption: "No demo yet. Screenshots from the current build.",
  },
} as const;

const oneBasketPhases: Phase[] = [
  { name: "Skeleton", status: "done" },
  { name: "Vertical slice", status: "current" },
  { name: "Input paths", status: "upcoming" },
  { name: "Multiplayer", status: "upcoming" },
  { name: "Money", status: "upcoming" },
  { name: "Premium", status: "upcoming" },
];

export const ONE_BASKET = {
  id: "one-basket",
  name: "One Basket",
  status: "building",
  statusLabel: "Building",
  summary: "Recipes in, buyable grocery quantities out.",
  phases: oneBasketPhases,
  /** Projects page track (named phases, stack-sm layout). */
  mapAriaLabel: "Build map: phase 2 of 6, Vertical slice",
  /** Home card track (dots only). */
  homeMapAriaLabel: "Build map: phase 2 of 6",
  homeCaption: "phase 2 of 6 · Vertical slice",
} as const;

export const COFURA = {
  id: "cofura",
  name: "Cofura",
  status: "building",
  statusLabel: "Building",
  summary:
    "A phone app where UCI students find cofounders and teammates. Swipe, match, chat. Not a dating app.",
  /** Home card blurb (shorter than the Projects page summary). */
  homeSummary: "Cofounder matching for UCI students. I own chat + safety.",
  myPart: {
    label: "My part",
    value: "chat + safety",
    body: "One of three engineers. I own conversation and safety (unmatch, block, report, message filtering), plus CI and the build setup.",
  },
  /** Current phase = Core loop (MVP); Foundations done, so the track fills to 1/6. */
  phases: [
    { name: "Foundations", status: "done" },
    { name: "Core loop (MVP)", status: "current" },
    { name: "Launch at UCI", status: "upcoming" },
    { name: "Trust + polish", status: "upcoming" },
    { name: "Growth", status: "upcoming" },
    { name: "Business", status: "upcoming" },
  ] satisfies Phase[],
  mapAriaLabel: "Build map: phase 2 of 6, Core loop (MVP)",
  homeMapAriaLabel: "Build map: phase 2 of 6",
  stack: "Expo · Supabase · GitHub Actions",
  homeCaption: "phase 2 of 6 · Core loop (MVP)",
  demo: {
    shots: ["[SCREEN 1]", "[SCREEN 2]", "[SCREEN 3]"],
    caption: "No public build yet. Screens from the current dev build.",
  },
} as const;

export const PULLPILOT = {
  id: "pullpilot",
  name: "PullPilot",
  status: "dead",
  statusLabel: "Dead",
  summary: "A crowdsourced auto-parts platform. My earlier app.",
  phases: [
    { name: "Idea", status: "done" },
    { name: "Features", status: "done" },
    { name: "Stopped: needed a rewrite", status: "done" },
  ] satisfies Phase[],
  mapAriaLabel: "Build map: stopped after features",
  epitaph: {
    label: "Why it died",
    body: "I built features with no design planned, so every screen looked different, and fixing it meant a rewrite.",
    aside: "That's why this site started with a design system.",
  },
  shots: ["[OLD SCREEN 1]", "[OLD SCREEN 2]", "[OLD SCREEN 3]"],
  demoCaption:
    "Never shipped a demo. Three screens from the last build, side by side: you can see the problem.",
  /** Home dead card. */
  homeBody:
    "No design planned, so every screen looked different. Fixing it meant a rewrite.",
  homeLink: "What I learned",
} as const;

/** Home "What I'm building" cards, in order. */
export const HOME_PROJECT_CARDS = [ONE_BASKET, COFURA, PULLPILOT] as const;
