// Resume content, copied exactly from design/screens/Resume.dc.html.
// Shapes map to Timeline (TimelineEntry), TimeLanes (TimeLane), Terminal (TermLine).
import type { TermLine } from "@/components/Terminal";
import type { TimeLane } from "@/components/TimeLanes";
import { CONTACT } from "./site";

export const RESUME_PAGE = {
  eyebrow: 'Masaki "Masa" Chien · CS at UC Irvine · graduating Mar 2028',
  title: "Resume",
  download: "Download PDF",
  email: "Email me",
  tabs: { timeline: "Timeline", terminal: "$ terminal" },
  tabsAria: "Resume view",
  glance: { title: "At a glance", legend: "blue = ongoing · line = today" },
  showEverything: "Show everything",
  terminalBack: { before: "Same resume, as commands. ", link: "Back to the timeline" },
  terminalAria: "Resume terminal",
} as const;

export const EDUCATION = {
  label: "Education",
  school: "UC Irvine",
  dates: "Sep 2025 – Mar 2028",
  degree: "B.S. Computer Science · graduating early",
  meterLabel: "Degree progress",
  /** 43% = 13 of 30 months (design). */
  meterRatio: 0.43,
  meterValueText: "43%",
} as const;

export type SkillKey = string;

export type ResumeEntry = {
  id: string;
  now: boolean;
  title: string;
  sub: string;
  when: string;
  stack: string;
  /** Skill tag keys used to filter (match SkillTag.key). */
  tags: SkillKey[];
  bullets: string[];
  /**
   * Instagram entry only: `stack` is a template for Task 4 to fill from getInstagramStats()
   * ({followers} -> compact followers, {start} -> first-post month, {views} -> compact views or its placeholder) so no
   * number is hard-coded here (decision 5).
   */
  stackFromStats?: true;
  /** Instagram entry only: bullets by source kind (the design says "Live stats"). */
  bulletsBySource?: Record<"manual" | "instagram-api", string[]>;
};

export const ENTRIES: ResumeEntry[] = [
  { id: "cofura", now: true, title: "Cofura · Cofounder", sub: "Cofounder-matching mobile app for UCI students", when: "Sep 2026 – now", stack: "Supabase · GitHub Actions · Claude Code", tags: ["Supabase", "Claude Code"],
    bullets: ["Lead a three-person student team; wrote the product spec and roadmap, and split the build into three owned slices so we build in parallel.", "Own the conversation and safety slice: messaging with rate limits and content moderation, plus unmatch, block and report flows enforced at the database level.", "Set up CI that runs the full database and server-function test suite on every pull request; cross-team decisions go in a numbered rulings log."] },
  { id: "onebasket", now: true, title: "One Basket", sub: "Recipe-to-grocery-list app, built end to end", when: "Aug 2026 – now", stack: "Claude Code · Claude Design · Gemini API", tags: ["Claude Code"],
    bullets: ["Building with Claude Code as the implementer: scoping each task, constraining it with written system invariants, and verifying changes before they land.", "Run AI work in parallel on isolated branches with declared file ownership, so concurrent changes can’t collide.", "Settle visual direction in Claude Design before production art is drawn."] },
  { id: "retrolink", now: true, title: "RetroLink", sub: "Automotive embedded sensor node", when: "Jul 2026 – now", stack: "C · STM32 · CAN bus · LTspice", tags: ["C", "Hardware", "Claude Code"],
    bullets: ["Designed an analog front end in LTspice scaling 0–5 V automotive sensor signals into the STM32F446RE’s 3.3 V ADC range; bench-tested with potentiometers.", "Streamed ADC readings as CAN frames at 500 kbps through a TJA1050 transceiver, with live readout on an I2C OLED.", "Root-caused a CAN init timeout to a floating RX pin reading dominant; fixed with an internal pull-up."] },
  { id: "ig", now: true, title: "@masamcodes", sub: "Building apps in public on Instagram", when: "{start} – now", stack: "{followers} followers · {views} views", stackFromStats: true, tags: [],
    // bullets = the design's original (live) text; manual wording lives in bulletsBySource (NEW copy).
    bullets: ["Posting what I build, numbers included. Live stats on the Stats page."],
    bulletsBySource: {
      manual: ["Posting what I build, numbers included. Stats on the Stats page."],
      "instagram-api": ["Posting what I build, numbers included. Live stats on the Stats page."],
    } },
  { id: "lavner", now: false, title: "Lavner Education · STEM Instructor Intern", sub: "Camp Tech Revolution · Foster City, CA", when: "Jun – Aug 2026", stack: "Teaching", tags: [],
    bullets: ["Taught hands-on AI, coding, robotics, game design and 3D modeling to elementary and middle school classes, adapting explanations in real time across skill levels."] },
  { id: "dungeon", now: false, title: "Dungeon Dilemma", sub: "Networked multiplayer Unity game · 15+ person team", when: "Jan – Mar 2026", stack: "C# · Unity · Git · Linear", tags: ["C#", "Unity"],
    bullets: ["Shipped the SpikeTrap and HauntedArmor hazards by extending the shared abstract Trap class, with coroutine-timed activation wired into networked combat.", "Fixed a bug where trigger collisions applied damage every physics frame, using a HashSet of players already hit per cycle.", "Refactored the shared AttackModule, merging duplicated damage paths behind overloaded CalculateAttackDamage signatures."] },
  { id: "kav", now: false, title: "KAV Helmets · 3D Printing Production Intern", sub: "Redwood City, CA", when: "Oct – Dec 2023", stack: "3D printing", tags: ["Hardware"],
    bullets: ["Ran and calibrated 100+ 3D printers in high-volume production; diagnosed stepper, thermal-runaway and adhesion failures, and standardized an adhesion fix fleet-wide."] },
  { id: "hockey", now: false, title: "Ice Center Cupertino · Youth Hockey Assistant Coach", sub: "Cupertino, CA", when: "Aug 2020 – Jun 2024", stack: "Coaching", tags: [],
    bullets: ["Ran practices for groups of 30+ players ages 6–14 and served as interim head coach, coordinating players, parents and staff."] },
];

/** Entries open on first render (design: cofura). */
export const DEFAULT_OPEN: string[] = ["cofura"];

export const ENTRY_GROUPS = [
  { title: "Right now", count: "4 ongoing", ids: ["cofura", "onebasket", "retrolink", "ig"] },
  { title: "Before", count: "2020 – 2026", ids: ["lavner", "dungeon", "kav", "hockey"] },
] as const;

export type SkillTag = { label: string; key: SkillKey };
export type SkillGroup = { label: string; tags: SkillTag[]; more?: string };

export const SKILL_GROUPS: SkillGroup[] = [
  { label: "Proficient", tags: [{ label: "Python", key: "Python" }, { label: "C++", key: "C++" }] },
  { label: "Working knowledge", tags: [{ label: "C", key: "C" }, { label: "C#", key: "C#" }, { label: "Java", key: "Java" }] },
  { label: "Tools", tags: [{ label: "Supabase", key: "Supabase" }, { label: "Unity", key: "Unity" }], more: "Also: Git, GitHub, Linear, VS Code, Cursor" },
  { label: "AI tools", tags: [{ label: "Claude Code", key: "Claude Code" }], more: "Also: Claude Cowork, Claude Design, Gemini API" },
  { label: "Hardware", tags: [{ label: "LTspice · 3D printing", key: "Hardware" }], more: "Also: Fusion 360, automotive diagnostics" },
];

export const SKILLS_CARD = { label: "Skills", hint: "Tap one to see where I used it." } as const;

/** Display name for the filter message (design: 'Hardware' reads as 'hardware'). */
export function skillDisplayName(key: SkillKey): string {
  return key === "Hardware" ? "hardware" : key;
}

/** Filter banner text, from the design's script. */
export function filterMessage(key: SkillKey, matches: number): string {
  const label = skillDisplayName(key);
  return matches
    ? `Showing where I used ${label} (${matches}${matches === 1 ? " entry)." : " entries)."}`
    : `Nothing on here uses ${label} yet.`;
}

// --- At a glance lanes: months on a 98-month axis starting Jan 2020 (design formula). ---
const AXIS_MONTHS = 98;
const pos = (year: number, month: number) => (((year - 2020) * 12 + (month - 1)) / AXIS_MONTHS) * 100;
/** Design "today" marker: Nov 2026 on the axis (hard-coded in the design, not the clock). */
export const LANES_NOW = pos(2026, 11);

export const LANE_TICKS = [
  { label: "2020", left: 0 },
  { label: "2022", left: 24.5 },
  { label: "2024", left: 49 },
  { label: "2026", left: 73.5 },
  { label: "2028", left: 98 },
] as const;

export const LANES_ARIA =
  "Timeline: hockey coaching Aug 2020 to Jun 2024; KAV Helmets Oct to Dec 2023; UC Irvine Sep 2025 to Mar 2028; Dungeon Dilemma Jan to Mar 2026; Lavner Jun to Aug 2026; RetroLink, One Basket and Cofura ongoing since Jul, Aug and Sep 2026.";

type Span = { entryId: string; label: string; when: string; tags: SkillKey[]; start: [number, number]; end: [number, number] | null; current: boolean };

const SPANS: Span[] = [
  { entryId: "cofura", label: "Cofura", when: "Sep 2026 – now", tags: ["Supabase", "Claude Code"], start: [2026, 9], end: null, current: true },
  { entryId: "onebasket", label: "One Basket", when: "Aug 2026 – now", tags: ["Claude Code"], start: [2026, 8], end: null, current: true },
  { entryId: "retrolink", label: "RetroLink", when: "Jul 2026 – now", tags: ["C", "Hardware", "Claude Code"], start: [2026, 7], end: null, current: true },
  { entryId: "lavner", label: "Lavner Education", when: "Jun – Aug 2026", tags: [], start: [2026, 6], end: [2026, 8], current: false },
  { entryId: "dungeon", label: "Dungeon Dilemma", when: "Jan – Mar 2026", tags: ["C#", "Unity"], start: [2026, 1], end: [2026, 3], current: false },
  { entryId: "kav", label: "KAV Helmets", when: "Oct – Dec 2023", tags: ["Hardware"], start: [2023, 10], end: [2023, 12], current: false },
  { entryId: "hockey", label: "Hockey coach", when: "Aug 2020 – Jun 2024", tags: [], start: [2020, 8], end: [2024, 6], current: false },
  { entryId: "uci", label: "UC Irvine", when: "Sep 2025 – Mar 2028", tags: ["Python", "C++", "C"], start: [2025, 9], end: [2028, 3], current: true },
];

/** Lanes + their filter tags. `dim` is applied by the page from the selected skill. */
export const LANES: (TimeLane & { tags: SkillKey[] })[] = SPANS.map((s) => {
  const a = pos(s.start[0], s.start[1]);
  const b = s.end ? pos(s.end[0], s.end[1] + 1) : LANES_NOW;
  return {
    label: s.label,
    title: s.when,
    left: Number(a.toFixed(1)),
    width: Number(Math.max(1.2, Math.min(100, b) - a).toFixed(1)),
    current: s.current,
    tags: s.tags,
  };
});

// --- Terminal ---
const M = (text: string): TermLine => ({ text, tone: "muted" });
const L = (text: string): TermLine => ({ text, tone: "plain" });

export const TERMINAL_INITIAL_LOG: TermLine[] = [
  M("masa chien · resume · type help, or tap a command"),
  L("$ whoami"),
  L('masaki "masa" chien · cs @ uc irvine · graduating mar 2028 (early)'),
  M("builds apps in public as @masamcodes"),
];

export const TERMINAL_CHIPS = ["help", "whoami", "projects", "experience", "skills", "education", "contact", "resume.pdf", "clear"];

export const TERMINAL_CLEAR_HINT = "type help, or tap a command";

export const TERMINAL_RESPONSES: Record<string, TermLine[]> = {
  // NEW copy: the design says "download the pdf", but PDF_URL is null so nothing can be downloaded yet.
  help: [M("commands:"), L("  whoami       who I am"), L("  projects     what I’m building"), L("  experience   jobs"), L("  skills       languages, tools, hardware"), L("  education    school + coursework"), L("  contact      email, github, linkedin"), L("  resume.pdf   not available yet"), L("  clear        clear the screen")],
  whoami: [L('masaki "masa" chien · cs @ uc irvine · graduating mar 2028 (early)'), M("builds apps in public as @masamcodes")],
  projects: [L("cofura           sep 2026–now   cofounder · messaging + safety slice · supabase, ci"), L("one basket       aug 2026–now   recipes → buyable grocery quantities · claude code"), L("retrolink        jul 2026–now   stm32 sensor node · can bus @ 500 kbps · ltspice"), L("dungeon dilemma  jan–mar 2026   unity multiplayer · 15+ person team · c#"), M("pullpilot        dead           no design planned → every screen differed → rewrite")],
  experience: [L("stem instructor intern         lavner education      jun–aug 2026"), L("3d printing production intern  kav helmets           oct–dec 2023"), L("youth hockey assistant coach   ice center cupertino  aug 2020–jun 2024")],
  skills: [L("proficient   python, c++"), L("working      c, c#, java"), L("tools        git, github, supabase, linear, unity, vs code, cursor"), L("ai           claude code, claude cowork, claude design, gemini api"), L("hardware     ltspice, fusion 360, 3d printing, automotive diagnostics")],
  education: [L("uc irvine · b.s. computer science · sep 2025 – mar 2028 (expected)"), M("python · c/c++ · data structures & algorithms (in progress) · intro to software engineering · computer organization · probability & statistics")],
  contact: [L(`email     ${CONTACT.email}`), L(`github    ${CONTACT.github.replace("https://", "")}`), L(`linkedin  ${CONTACT.linkedin.replace("https://", "")}`), L("instagram @masamcodes")],
  // NEW copy (not from the design): PDF_URL is null, so nothing can be downloaded yet (decision 4).
  // Design's line, for when PDF_URL exists: [M("preparing pdf…"), { text: "✓ downloaded masaki_chien_resume.pdf", tone: "ok" }]
  "resume.pdf": [M("no pdf yet. type contact to reach me for a copy")],
};
