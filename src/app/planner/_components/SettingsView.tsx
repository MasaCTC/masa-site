"use client";
import type { SettingsView as Settings } from "@/lib/planner/queries";
export function SettingsView({ panelId, tabId }: { panelId: string; tabId: string; settings: Settings }) {
  return <section id={panelId} role="tabpanel" aria-labelledby={tabId} className="mn-grid" />;
}
