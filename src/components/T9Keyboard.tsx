import React, { useEffect, useMemo, useRef, useState } from "react";

type Direction = "center" | "left" | "right" | "up" | "down";

export interface T9KeyboardProps {
  // Called when the keyboard wants to insert text
  onInput: (text: string) => void;
  // Optional: control visibility externally in the future
  initialPosition?: { x: number; y: number };
  // If true, render without floating frame/drag; used when embedded in containers
  embedded?: boolean;
}

// Mapping helper to create flick layout entries
interface FlickMap {
  label: string; // visible label on the key (usually the "a" variant)
  map: Partial<Record<Direction, string>>; // direction -> char
}

const makeRow = (items: Array<FlickMap | null>) => items;

// Canonical flick mapping used by many JP keyboards:
// center = a-row head; left=i; up=u; right=e; down=o
// Special rows (ya/wa) have fewer outputs.
const FLICK_LAYOUT: Array<Array<FlickMap | null>> = [
  makeRow([
    {
      label: "あ",
      map: { center: "あ", left: "い", up: "う", right: "え", down: "お" },
    },
    {
      label: "か",
      map: { center: "か", left: "き", up: "く", right: "け", down: "こ" },
    },
    {
      label: "さ",
      map: { center: "さ", left: "し", up: "す", right: "せ", down: "そ" },
    },
  ]),
  makeRow([
    {
      label: "た",
      map: { center: "た", left: "ち", up: "つ", right: "て", down: "と" },
    },
    {
      label: "な",
      map: { center: "な", left: "に", up: "ぬ", right: "ね", down: "の" },
    },
    {
      label: "は",
      map: { center: "は", left: "ひ", up: "ふ", right: "へ", down: "ほ" },
    },
  ]),
  makeRow([
    {
      label: "ま",
      map: { center: "ま", left: "み", up: "む", right: "め", down: "も" },
    },
    { label: "や", map: { center: "や", up: "ゆ", down: "よ" } },
    {
      label: "ら",
      map: { center: "ら", left: "り", up: "る", right: "れ", down: "ろ" },
    },
  ]),
  makeRow([
    // Dakuten/handakuten modifier key at bottom-left
    {
      label: "゛゜",
      map: { center: "{dakuten}", left: "{dakuten}", right: "{handakuten}" },
    },
    // わ key at bottom center; right flick types "ー"
    { label: "わ", map: { center: "わ", up: "ん", right: "ー" } },
    { label: "⌫", map: { center: "⌫" } },
  ]),
];

const KEY_SIZE = 56; // px
const KEY_GAP = 8; // px

const containerShadow =
  "0 10px 30px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.02) inset";

const T9Keyboard: React.FC<T9KeyboardProps> = ({
  onInput,
  initialPosition,
  embedded = false,
}) => {
  // Draggable position (fixed coordinates)
  const [pos, setPos] = useState<{ x: number; y: number }>(() => ({
    x: 0,
    y: 0,
  }));
  const dragging = useRef(false);
  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragPointerId = useRef<number | null>(null);
  const containerSize = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize default position near bottom-right and clamp on resize
  useEffect(() => {
    if (embedded) return; // embedded mode doesn't manage its own position
    const width = 3 * KEY_SIZE + 2 * KEY_GAP + 24 /*padding*/ * 2;
    const height = 4 * KEY_SIZE + 3 * KEY_GAP + 40 /*header*/ + 24 * 2;

    // Set initial position only once (or if initialPosition changes)
    setPos(() => {
      const x =
        initialPosition?.x ?? Math.max(12, window.innerWidth - width - 24);
      const y =
        initialPosition?.y ?? Math.max(12, window.innerHeight - height - 24);
      return { x, y };
    });

    // Clamp current position on resize so the keyboard stays within viewport
    const onResize = () => {
      const maxX = Math.max(12, window.innerWidth - width - 12);
      const maxY = Math.max(12, window.innerHeight - height - 12);
      setPos((prev) => ({
        x: Math.max(12, Math.min(prev.x, maxX)),
        y: Math.max(12, Math.min(prev.y, maxY)),
      }));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [initialPosition, embedded]);

  const clampToViewport = (nx: number, ny: number) => {
    const maxX = Math.max(0, window.innerWidth - containerSize.current.w);
    const maxY = Math.max(0, window.innerHeight - containerSize.current.h);
    return {
      x: Math.min(Math.max(0, nx), maxX),
      y: Math.min(Math.max(0, ny), maxY),
    };
  };

  const onDragPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = true;
    dragPointerId.current = e.pointerId;
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) containerSize.current = { w: rect.width, h: rect.height };
    const startX = e.clientX;
    const startY = e.clientY;
    dragOffset.current = { x: startX - pos.x, y: startY - pos.y };

    const move = (ev: PointerEvent) => {
      if (
        !dragging.current ||
        (dragPointerId.current !== null &&
          ev.pointerId !== dragPointerId.current)
      )
        return;
      ev.preventDefault();
      const nx = ev.clientX - dragOffset.current.x;
      const ny = ev.clientY - dragOffset.current.y;
      setPos(clampToViewport(nx, ny));
    };
    const up = (ev: PointerEvent) => {
      if (
        dragPointerId.current !== null &&
        ev.pointerId !== dragPointerId.current
      )
        return;
      ev.preventDefault();
      dragging.current = false;
      dragPointerId.current = null;
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", up, true);
    };
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", up, true);
  };
  // Dummy handlers to satisfy React props; we handle via window listeners
  const onDragPointerMove = (e: React.PointerEvent) => {
    if (dragging.current) e.preventDefault();
  };
  const onDragPointerUp = (e: React.PointerEvent) => {
    if (dragging.current) e.preventDefault();
  };

  // Flick handling state for an individual key interaction
  const startPoint = useRef<{ x: number; y: number } | null>(null);
  const activeKey = useRef<FlickMap | null>(null);
  // Long-press handling (for backspace clear-all)
  const longPressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);

  const decideDirection = (
    dx: number,
    dy: number,
    threshold = 18
  ): Direction => {
    const dist = Math.hypot(dx, dy);
    if (dist < threshold) return "center";
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    if (adx > ady) return dx > 0 ? "right" : "left";
    return dy > 0 ? "down" : "up";
  };

  const handleKeyPointerDown = (key: FlickMap) => (e: React.PointerEvent) => {
    startPoint.current = { x: e.clientX, y: e.clientY };
    activeKey.current = key;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    // Setup long-press only for backspace key
    longPressFired.current = false;
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (key.label === "⌫") {
      longPressTimer.current = window.setTimeout(() => {
        longPressFired.current = true;
        onInput("{clear}");
      }, 200);
    }
  };
  const handleKeyPointerUp = (e: React.PointerEvent) => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (longPressFired.current) {
      // Long-press already handled a clear; swallow this pointer up
      longPressFired.current = false;
      startPoint.current = null;
      activeKey.current = null;
      (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
      return;
    }
    const sp = startPoint.current;
    const key = activeKey.current;
    startPoint.current = null;
    activeKey.current = null;
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
    if (!sp || !key) return;
    const dx = e.clientX - sp.x;
    const dy = e.clientY - sp.y;
    const dir = decideDirection(dx, dy);
    const ch = key.map[dir];
    if (!ch) return;
    if (ch === "⌫") {
      onInput("\b");
    } else if (ch === "{dakuten}" || ch === "{handakuten}") {
      onInput(ch);
    } else {
      onInput(ch);
    }
  };

  const palette = useMemo(
    () => ({
      bg: "#2a2652",
      bgSoft: "#242046",
      border: "#4e4893",
      text: "#e9e9f1",
      accent: "#ff79c6",
      highlight: "#3b356e",
    }),
    []
  );

  return (
    <div
      ref={containerRef}
      style={{
        position: embedded ? "relative" : "fixed",
        left: embedded ? undefined : pos.x,
        top: embedded ? undefined : pos.y,
        zIndex: embedded ? "auto" : 1000,
        background: embedded ? "transparent" : palette.bg,
        border: embedded ? "none" : `1px solid ${palette.border}`,
        borderRadius: embedded ? 0 : 12,
        padding: embedded ? 0 : 16,
        boxShadow: embedded ? "none" : containerShadow,
        color: palette.text,
        userSelect: "none",
        touchAction: embedded ? "auto" : "none",
        width: embedded ? "auto" : 3 * KEY_SIZE + 2 * KEY_GAP + 16 * 2,
      }}
    >
      {/* Drag handle (hidden when embedded) */}
      {!embedded && (
        <div
          onPointerDown={onDragPointerDown}
          onPointerMove={onDragPointerMove}
          onPointerUp={onDragPointerUp}
          style={{
            cursor: dragging.current ? "grabbing" : "grab",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "4px 4px 10px 4px",
            color: palette.accent,
            fontWeight: 600,
            touchAction: "none",
          }}
        >
          <span>T9</span>
          <span style={{ fontSize: 12, color: palette.text, opacity: 0.7 }}>
            drag
          </span>
        </div>
      )}

      {/* Grid keys */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(3, ${KEY_SIZE}px)`,
          gap: KEY_GAP,
        }}
      >
        {FLICK_LAYOUT.flatMap((row, rIdx) =>
          row.map((key, cIdx) =>
            key ? (
              <button
                key={`${rIdx}-${cIdx}-${key.label}`}
                onPointerDown={handleKeyPointerDown(key)}
                onPointerUp={handleKeyPointerUp}
                style={{
                  width: KEY_SIZE,
                  height: KEY_SIZE,
                  borderRadius: 10,
                  border: `1px solid ${palette.border}`,
                  background: palette.bgSoft,
                  color: key.label === "⌫" ? palette.accent : palette.text,
                  fontSize: 18,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 1px 0 rgba(0,0,0,0.4) inset",
                  touchAction: "none",
                }}
                aria-label={`key ${key.label}`}
                title={(() => {
                  if (key.label === "⌫") return "Backspace (hold to clear)";
                  const pretty = (v?: string) =>
                    v === "{dakuten}"
                      ? "゛ (dakuten)"
                      : v === "{handakuten}"
                      ? "゜ (handakuten)"
                      : v ?? "";
                  return Object.entries(key.map)
                    .map(([d, ch]) => `${d}: ${pretty(ch)}`)
                    .join("  ");
                })()}
                onPointerCancel={(ev) => {
                  if (longPressTimer.current) {
                    window.clearTimeout(longPressTimer.current);
                    longPressTimer.current = null;
                  }
                  longPressFired.current = false;
                  startPoint.current = null;
                  activeKey.current = null;
                  (ev.currentTarget as Element).releasePointerCapture?.(
                    ev.pointerId
                  );
                }}
              >
                {key.label}
              </button>
            ) : (
              <div
                key={`${rIdx}-${cIdx}-spacer`}
                style={{ width: KEY_SIZE, height: KEY_SIZE }}
                aria-hidden
              />
            )
          )
        )}
      </div>
    </div>
  );
};

export default T9Keyboard;
