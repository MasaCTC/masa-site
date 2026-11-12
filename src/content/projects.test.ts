import { test } from "node:test";
import assert from "node:assert/strict";
import * as projects from "./projects.ts";
import {
  COFURA,
  COFURA_TESTFLIGHT_URL,
  HOME_PROJECT_CARDS,
  ONE_BASKET,
  PROJECTS,
  PROJECTS_PAGE,
  PULLPILOT,
  hasSidePanel,
  projectCountLabel,
  rightNow,
} from "./projects.ts";
import * as site from "./site.ts";
import * as resume from "./resume.ts";

/** Every string value in a structure (functions skipped). */
function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => strings(x, out));
  return out;
}

test("rightNow: only active projects, then the school row (Launch section 6)", () => {
  assert.deepEqual(rightNow(PROJECTS), [
    { text: "Building Cofura on a team of three", kind: "status", status: "building", statusLabel: "Building" },
    { text: "Cofura beta is on TestFlight", kind: "link", linkText: "Join", href: "https://testflight.apple.com/join/wmHz6cN1" },
    { text: "CS at UCI, graduating early", kind: "mono", mono: "Mar 2028" },
  ]);
});

test("rightNow: a paused project never appears, whatever it is", () => {
  const pausedCofura = { ...COFURA, status: "paused" as const };
  assert.deepEqual(rightNow([pausedCofura, ONE_BASKET, PULLPILOT]), [
    { text: "CS at UCI, graduating early", kind: "mono", mono: "Mar 2028" },
  ]);
  const deadCofura = { ...COFURA, status: "dead" as const };
  assert.equal(rightNow([deadCofura]).length, 1);
});

test("One Basket is paused with the requested reason", () => {
  assert.equal(ONE_BASKET.status, "paused");
  assert.equal(ONE_BASKET.statusLabel, "Paused");
  assert.equal(
    ONE_BASKET.epitaph.body,
    "Cofura has all my build time right now. The vertical slice works; I'll pick it back up after Cofura launches at UCI.",
  );
  assert.equal(ONE_BASKET.epitaph.label, "Why it's paused");
  assert.equal(ONE_BASKET.mapLabel, "Build map · stopped at phase 2");
  assert.equal(ONE_BASKET.mapAriaLabel, "Build map: paused at phase 2 of 6, Vertical slice");
  assert.equal(ONE_BASKET.homeMapAriaLabel, "Build map: paused at phase 2 of 6");
  assert.equal(ONE_BASKET.homeCaption, "paused at phase 2 · Vertical slice");
});

test("Cofura is at phase 3 of 6, Launch at UCI, with the TestFlight beta", () => {
  assert.deepEqual(
    COFURA.phases.map((p) => p.status),
    ["done", "done", "current", "upcoming", "upcoming", "upcoming"],
  );
  assert.equal(COFURA.phases[2].name, "Launch at UCI");
  assert.equal(COFURA.mapAriaLabel, "Build map: phase 3 of 6, Launch at UCI");
  assert.equal(COFURA.homeMapAriaLabel, "Build map: phase 3 of 6");
  assert.equal(COFURA.homeCaption, "phase 3 of 6 · Launch at UCI · beta on TestFlight");
  assert.equal(COFURA.statusDetail, "· beta on TestFlight");
  assert.equal(COFURA_TESTFLIGHT_URL, "https://testflight.apple.com/join/wmHz6cN1");
  assert.equal(COFURA.beta.href, COFURA_TESTFLIGHT_URL);
  assert.equal(COFURA.beta.linkText, "Join the TestFlight beta");
});

test("Projects header count is derived: 1 building · 1 paused · 1 dead", () => {
  assert.equal(projectCountLabel(PROJECTS), "1 building · 1 paused · 1 dead");
  assert.equal(PROJECTS_PAGE.eyebrow, "1 building · 1 paused · 1 dead");
});

test("two columns only with real screenshots or a beta block", () => {
  assert.equal(hasSidePanel(COFURA), true);
  assert.equal(hasSidePanel(ONE_BASKET), false);
  assert.equal(hasSidePanel(PULLPILOT), false);
  assert.equal(hasSidePanel({ ...PULLPILOT, shots: [{ src: "/a.png", alt: "A" }] }), true);
  for (const p of PROJECTS) assert.deepEqual(p.shots, [], `${p.name} has no real screenshots yet`);
});

test("orders: /projects follows the design, Home puts the active project first", () => {
  assert.deepEqual(PROJECTS.map((p) => p.name), ["One Basket", "Cofura", "PullPilot"]);
  assert.deepEqual(HOME_PROJECT_CARDS.map((p) => p.name), ["Cofura", "One Basket", "PullPilot"]);
});

test("no bracket placeholder or stale build state in project, site or resume copy", () => {
  const texts = strings([projects, site, resume]);
  assert.ok(texts.length > 50);
  assert.deepEqual(texts.filter((t) => /\[[A-Z0-9 ]+\]/.test(t)), []);
  // "phase 2 of 6" is only right for the paused One Basket ("paused at phase 2 of 6").
  assert.deepEqual(texts.filter((t) => /phase 2 of 6/.test(t) && !/paused at phase 2 of 6/.test(t)), []);
  assert.deepEqual(texts.filter((t) => /2 building|Building One Basket/.test(t)), []);
  assert.equal("ONE_BASKET_DEMO" in projects, false);
  assert.equal("ONE_BASKET_DEMO_URL" in site, false);
});

test("resume: One Basket is not listed as ongoing", () => {
  const rightNowGroup = resume.ENTRY_GROUPS.find((g) => g.title === "Right now");
  assert.ok(rightNowGroup);
  assert.equal((rightNowGroup.ids as readonly string[]).includes("onebasket"), false);
  assert.equal(rightNowGroup.count, "3 ongoing");
  const entry = resume.ENTRIES.find((e) => e.id === "onebasket");
  assert.equal(entry?.now, false);
  assert.equal(resume.LANES.find((l) => l.label === "One Basket")?.current, false);
  assert.ok(!/One Basket and Cofura ongoing|RetroLink, One Basket/.test(resume.LANES_ARIA));
  const termProjects = resume.TERMINAL_RESPONSES.projects.map((l) => l.text).join("\n");
  assert.ok(!/one basket\s+aug 2026–now/.test(termProjects));
});
