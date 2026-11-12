// Projects content, copied from design/screens/Projects.dc.html and Launch.dc.html sections 5
// and 6 (One Basket paused, Cofura at phase 3 with the TestFlight beta, screenshot slots hidden
// until real screenshots exist). Types map onto src/components props (ProgressTrack, StatusLabel).
// Pure data + functions only (no React / Next imports), so node:test can load it.
import type { Shot } from "@/components/DemoArea";
import type { Phase } from "@/components/ProgressTrack";

export type { Shot };

export type ProjectStatus = "building" | "scoping" | "paused" | "dead";

/** Cofura's public TestFlight beta (Launch.dc.html section 5). */
export const COFURA_TESTFLIGHT_URL = "https://testflight.apple.com/join/wmHz6cN1";

export const PROJECTS_PAGE = {
  title: "Projects",
  lead: "What I'm building, where each one actually is, and one that didn't make it.",
  cta: "Follow the build",
  buildMapLabel: "Build map",
  /** Header count, derived from the project statuses ("1 building · 1 paused · 1 dead"). */
  get eyebrow(): string {
    return projectCountLabel(PROJECTS);
  },
};

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
  status: "paused" as ProjectStatus,
  statusLabel: "Paused",
  summary: "Recipes in, buyable grocery quantities out.",
  phases: oneBasketPhases,
  /** Projects page map label (replaces the plain "Build map"). */
  mapLabel: "Build map · stopped at phase 2",
  /** Projects page track (named phases, stack-sm layout). */
  mapAriaLabel: "Build map: paused at phase 2 of 6, Vertical slice",
  /** Home card track (dots only). */
  homeMapAriaLabel: "Build map: paused at phase 2 of 6",
  homeCaption: "paused at phase 2 · Vertical slice",
  epitaph: {
    label: "Why it's paused",
    body: "Cofura has all my build time right now. The vertical slice works; I'll pick it back up after Cofura launches at UCI.",
  },
  /** Real screenshots only. Empty = the card collapses to one column with no screenshot area. */
  shots: [] as Shot[],
  /** Paused: never listed in Home "Right now". */
  rightNow: [] as RightNowRow[],
};

export const COFURA = {
  id: "cofura",
  name: "Cofura",
  status: "building" as ProjectStatus,
  statusLabel: "Building",
  /** Projects page only, in <small> after the status word. */
  statusDetail: "· beta on TestFlight",
  summary:
    "A phone app where UCI students find cofounders and teammates. Swipe, match, chat. Not a dating app.",
  /** Home card blurb (shorter than the Projects page summary). */
  homeSummary: "Cofounder matching for UCI students. I own chat + safety.",
  myPart: {
    label: "My part",
    value: "chat + safety",
    body: "One of three engineers. I own conversation and safety (unmatch, block, report, message filtering), plus CI and the build setup.",
  },
  /** Current phase = Launch at UCI; Foundations and Core loop done, so the track fills to 2/6. */
  phases: [
    { name: "Foundations", status: "done" },
    { name: "Core loop (MVP)", status: "done" },
    { name: "Launch at UCI", status: "current" },
    { name: "Trust + polish", status: "upcoming" },
    { name: "Growth", status: "upcoming" },
    { name: "Business", status: "upcoming" },
  ] as Phase[],
  mapLabel: "Build map",
  mapAriaLabel: "Build map: phase 3 of 6, Launch at UCI",
  homeMapAriaLabel: "Build map: phase 3 of 6",
  stack: "Expo · Supabase · GitHub Actions",
  homeCaption: "phase 3 of 6 · Launch at UCI · beta on TestFlight",
  /** TestFlight block in the right column (opens in a new tab). */
  beta: {
    label: "Public beta · iPhone",
    heading: "Try Cofura before it launches",
    body: "It's an early build, so things will break. Install Apple's TestFlight app, then join from your iPhone.",
    linkText: "Join the TestFlight beta",
    href: COFURA_TESTFLIGHT_URL,
    note: "testflight.apple.com · opens in a new tab",
  },
  shots: [] as Shot[],
  /** Home "Right now" rows while this project is active. */
  rightNow: [
    { text: "Building Cofura on a team of three", kind: "status", status: "building", statusLabel: "Building" },
    { text: "Cofura beta is on TestFlight", kind: "link", linkText: "Join", href: COFURA_TESTFLIGHT_URL },
  ] as RightNowRow[],
};

export const PULLPILOT = {
  id: "pullpilot",
  name: "PullPilot",
  status: "dead" as ProjectStatus,
  statusLabel: "Dead",
  summary: "A crowdsourced auto-parts platform. My earlier app.",
  phases: [
    { name: "Idea", status: "done" },
    { name: "Features", status: "done" },
    { name: "Stopped: needed a rewrite", status: "done" },
  ] as Phase[],
  mapAriaLabel: "Build map: stopped after features",
  epitaph: {
    label: "Why it died",
    body: "I built features with no design planned, so every screen looked different, and fixing it meant a rewrite.",
    aside: "That's why this site started with a design system.",
  },
  shots: [] as Shot[],
  /** Home dead card. */
  homeBody:
    "No design planned, so every screen looked different. Fixing it meant a rewrite.",
  homeLink: "What I learned",
  rightNow: [] as RightNowRow[],
};

/** What the derived functions need from a project. */
export type ProjectLike = {
  name: string;
  status: ProjectStatus;
  shots: readonly Shot[];
  beta?: unknown;
  rightNow: readonly RightNowRow[];
};

/** /projects order (Launch.dc.html section 5). */
export const PROJECTS = [ONE_BASKET, COFURA, PULLPILOT];

/** Home "What I'm building" cards: active first, then paused, then dead (section 6). */
export const HOME_PROJECT_CARDS = [COFURA, ONE_BASKET, PULLPILOT] as const;

// --- Home "Right now" ---

export type RightNowRow =
  | { text: string; kind: "status"; status: ProjectStatus; statusLabel: string }
  | { text: string; kind: "link"; linkText: string; href: string }
  | { text: string; kind: "mono"; mono: string };

/** The school row that always closes "Right now". */
export const RIGHT_NOW_SCHOOL: RightNowRow = { text: "CS at UCI, graduating early", kind: "mono", mono: "Mar 2028" };

/** "Right now" rows: active projects' rows (paused and dead never), then the school row. */
export function rightNow(projects: readonly ProjectLike[]): RightNowRow[] {
  return [
    ...projects.filter((p) => p.status !== "paused" && p.status !== "dead").flatMap((p) => p.rightNow),
    RIGHT_NOW_SCHOOL,
  ];
}

// --- Projects page ---

const COUNT_ORDER: ProjectStatus[] = ["building", "scoping", "paused", "dead"];

/** Header count: "1 building · 1 paused · 1 dead" (statuses with no projects are left out). */
export function projectCountLabel(projects: readonly ProjectLike[]): string {
  return COUNT_ORDER.map((s) => [s, projects.filter((p) => p.status === s).length] as const)
    .filter(([, n]) => n > 0)
    .map(([s, n]) => `${n} ${s}`)
    .join(" · ");
}

/** Two-column card only when there is something real to show on the right. */
export function hasSidePanel(project: Pick<ProjectLike, "shots" | "beta">): boolean {
  return project.shots.length > 0 || project.beta != null;
}
