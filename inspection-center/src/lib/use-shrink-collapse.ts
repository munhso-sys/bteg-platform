"use client";

import { useEffect, useState } from "react";

const MSG = "inspect-chrome";
const LOCK_MS = 300;
const ACCUM_DOWN = 28;
const ACCUM_UP = 28;
const MIN_Y = 48;

function publishCollapsed(next: boolean) {
  try {
    window.parent?.postMessage({ type: MSG, collapsed: next }, "*");
  } catch {
    // ignore
  }
}

/**
 * Stable shrink-collapse for duty modules.
 * Accumulates small trackpad deltas so collapse works on every page.
 */
export function useShrinkCollapse(scrollEl: HTMLElement | null): boolean {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!scrollEl) return;
    const el = scrollEl;
    publishCollapsed(false);

    let lastY = el.scrollTop;
    let accum = 0;
    let current = false;
    let lockedUntil = 0;
    let ticking = false;

    function setNext(next: boolean) {
      if (next === current) return;
      const now = performance.now();
      if (now < lockedUntil) return;
      current = next;
      lockedUntil = now + LOCK_MS;
      accum = 0;
      setCollapsed(next);
      publishCollapsed(next);
      requestAnimationFrame(() => {
        lastY = el.scrollTop;
      });
    }

    function applyDelta(delta: number, y: number) {
      const now = performance.now();
      if (now < lockedUntil) {
        lastY = y;
        accum = 0;
        return;
      }
      if (delta === 0) return;
      // Reset accumulation when direction flips.
      if (accum !== 0 && Math.sign(accum) !== Math.sign(delta)) accum = 0;
      accum += delta;
      lastY = y;

      if (!current && y >= MIN_Y && accum >= ACCUM_DOWN) {
        setNext(true);
        return;
      }
      if (current && (accum <= -ACCUM_UP || y <= 16)) {
        setNext(false);
      }
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const y = el.scrollTop;
        applyDelta(y - lastY, y);
      });
    }

    function onWheel(e: WheelEvent) {
      // Help pages where scroll events are sparse; still prefer real scrollTop.
      if (Math.abs(e.deltaY) < 2) return;
      const y = el.scrollTop;
      applyDelta(e.deltaY, y);
    }

    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("wheel", onWheel);
      publishCollapsed(false);
    };
  }, [scrollEl]);

  return collapsed;
}
