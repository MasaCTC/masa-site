"use client";
// Tabs (Tabs.md): segmented control in an inset rail; the selected tab is raised by one sliding thumb.
// Controlled (`selected` + `onSelect`) or uncontrolled (`defaultSelected`), so a server
// page can render it with serializable props only.
import { useState } from "react";
import styles from "./Tabs.module.css";
import { cx } from "./types";
import { useSlidingThumb } from "./useSlidingThumb";

export type TabItem = {
  id: string;
  label: string;
  disabled?: boolean;
  /** Mono face (Resume "$ terminal" tab). */
  mono?: boolean;
  /** id of the panel this tab controls. */
  controls?: string;
  /** DOM id for the tab button (a tabpanel points back with aria-labelledby). */
  domId?: string;
};

export type TabsProps = {
  tabs: TabItem[];
  ariaLabel: string;
  selected?: string;
  defaultSelected?: string;
  onSelect?: (id: string) => void;
  /** The newly selected tab's panel is loading (.mn-tabs.is-loading). */
  loading?: boolean;
  className?: string;
};

export function Tabs({
  tabs,
  ariaLabel,
  selected,
  defaultSelected,
  onSelect,
  loading = false,
  className,
}: TabsProps) {
  const [internal, setInternal] = useState(defaultSelected ?? tabs[0]?.id);
  const current = selected ?? internal;
  const { containerRef, thumbRef, className: thumbClass } = useSlidingThumb<HTMLDivElement>(
    (c) => c.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]'),
    current,
  );

  return (
    <div
      ref={containerRef}
      className={cx("mn-tabs", loading && "is-loading", thumbClass, className)}
      role="tablist"
      aria-label={ariaLabel}
    >
      <span ref={thumbRef} className="mn-thumb" aria-hidden="true" />
      {tabs.map((tab) => (
        <button
          key={tab.id}
          id={tab.domId}
          type="button"
          className={cx("mn-tab", tab.mono && styles.mono)}
          role="tab"
          aria-selected={tab.id === current}
          aria-controls={tab.controls}
          disabled={tab.disabled}
          onClick={() => {
            if (selected === undefined) setInternal(tab.id);
            onSelect?.(tab.id);
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
