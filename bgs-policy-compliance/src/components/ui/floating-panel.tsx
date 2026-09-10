"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type Coords = { top: number; left: number; maxHeight: number };

function placePanel(
  anchor: DOMRect,
  panelWidth: number,
  preferred: "left" | "right",
): Coords {
  const gap = 8;
  const maxHeight = Math.min(440, window.innerHeight - 16);
  let left =
    preferred === "left" ? anchor.left - panelWidth - gap : anchor.right + gap;
  if (left < 8) {
    left = Math.min(anchor.right + gap, window.innerWidth - panelWidth - 8);
  }
  if (left + panelWidth > window.innerWidth - 8) {
    left = Math.max(8, anchor.left - panelWidth - gap);
  }
  let top = anchor.top;
  if (top + Math.min(280, maxHeight) > window.innerHeight - 8) {
    top = Math.max(8, window.innerHeight - maxHeight - 8);
  }
  if (top < 8) top = 8;
  return { top, left, maxHeight };
}

/**
 * Renders a panel in a portal above all cards/tables (fixed).
 * Closes on outside click / Escape — not on mouseleave (so scrollbars stay usable).
 */
export function FloatingPanel({
  open,
  onClose,
  anchorRef,
  preferred = "left",
  width = 288,
  id,
  label,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  preferred?: "left" | "right";
  width?: number;
  id?: string;
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<Coords>({
    top: 0,
    left: 0,
    maxHeight: 400,
  });

  useEffect(() => setMounted(true), []);

  const update = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    setCoords(placePanel(el.getBoundingClientRect(), width, preferred));
  }, [anchorRef, preferred, width]);

  useLayoutEffect(() => {
    if (!open) return;
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, update]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      ref={panelRef}
      id={id}
      role="dialog"
      aria-label={label}
      style={{
        position: "fixed",
        top: coords.top,
        left: coords.left,
        width,
        maxHeight: coords.maxHeight,
        zIndex: 10000,
      }}
      className={cn(
        "overflow-y-auto rounded border border-[var(--border)] bg-[var(--card)] p-2.5 text-[var(--fg)] shadow-xl soft-scroll",
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  );
}
