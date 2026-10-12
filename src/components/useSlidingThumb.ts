"use client";
// Sliding thumb (design/system/thumb.js, Tabs.md, NavBar.md): ONE raised piece that
// travels to the selected item and morphs to its size. Shared by Tabs and the dock NavBar.
//
// Server render and first client render are the static design (the selected item draws its own
// raised fill, the thumb span is invisible). After mount the hook measures the target and sets
// --thumb-x/-y/-w/-h BEFORE adding .has-thumb, then adds .is-thumb-ready one frame later
// so the first paint never animates in from 0,0. Reduced motion is handled in CSS.
//
// The two classes live in React state and come back as `className` (merge it into the
// container's own classes): a manual classList.add would be wiped the next time React
// re-renders the container's className (e.g. Tabs' is-loading).
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { cx } from "./types";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export type SlidingThumb<T extends HTMLElement> = {
  /** Attach to the container. */
  containerRef: RefObject<T | null>;
  /** Attach to <span className="mn-thumb" aria-hidden="true">, the container's FIRST child. */
  thumbRef: RefObject<HTMLSpanElement | null>;
  /** "has-thumb" / "is-thumb-ready" once active; merge into the container's className. */
  className: string;
  /** Measure now. Pass an element to move the thumb there (instant feel on click). */
  place: (el?: HTMLElement | null) => void;
};

/**
 * @param getTarget  Returns the selected element inside the container (read at measure time).
 * @param settleKey  Re-measure whenever this changes (selected tab id, pathname).
 */
export function useSlidingThumb<T extends HTMLElement>(
  getTarget: (container: T) => HTMLElement | null | undefined,
  settleKey: unknown,
): SlidingThumb<T> {
  const containerRef = useRef<T>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const getTargetRef = useRef(getTarget);
  const [hasThumb, setHasThumb] = useState(false);
  const [ready, setReady] = useState(false);

  useIsoLayoutEffect(() => {
    getTargetRef.current = getTarget;
  });

  const place = useCallback((override?: HTMLElement | null) => {
    const container = containerRef.current;
    const thumb = thumbRef.current;
    if (!container || !thumb) return;
    const el = override ?? getTargetRef.current(container);
    if (!el) {
      // Nothing selected (e.g. a page that isn't in the nav): hide rather than leave a stale thumb.
      thumb.style.setProperty("--thumb-w", "0px");
      thumb.style.setProperty("--thumb-h", "0px");
      return;
    }
    const c = container.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    thumb.style.setProperty("--thumb-x", `${r.left - c.left - container.clientLeft}px`);
    thumb.style.setProperty("--thumb-y", `${r.top - c.top - container.clientTop}px`);
    thumb.style.setProperty("--thumb-w", `${r.width}px`);
    thumb.style.setProperty("--thumb-h", `${r.height}px`);
  }, []);

  // Mount: measure first, then turn the thumb on, then (a frame later) turn transitions on.
  useIsoLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    place();
    setHasThumb(true);
    let cancelled = false;
    const raf = requestAnimationFrame(() => {
      if (!cancelled) setReady(true);
    });
    const ro = new ResizeObserver(() => place());
    ro.observe(container);
    document.fonts?.ready.then(() => {
      if (!cancelled) place();
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [place]);

  // Settle on the new selection (runs after React has committed aria-selected / aria-current).
  useIsoLayoutEffect(() => {
    place();
  }, [settleKey, place]);

  return {
    containerRef,
    thumbRef,
    className: cx(hasThumb && "has-thumb", hasThumb && ready && "is-thumb-ready"),
    place,
  };
}
