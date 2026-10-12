"use client";
// Tabs (Tabs.md): segmented control in an inset rail; the selected tab is raised.
// Controlled (`selected` + `onSelect`) or uncontrolled (`defaultSelected`), so a server
// page can render it with serializable props only.
import { useState } from "react";
import styles from "./Tabs.module.css";
import { cx } from "./types";

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

  return (
    <div
      className={cx("mn-tabs", loading && "is-loading", className)}
      role="tablist"
      aria-label={ariaLabel}
    >
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
