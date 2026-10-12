"use client";
export function CalendarView({ panelId, tabId }: { panelId: string; tabId: string }) {
  return <section id={panelId} role="tabpanel" aria-labelledby={tabId} className="mn-section" />;
}
