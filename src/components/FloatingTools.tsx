import React, { useEffect, useMemo, useRef, useState } from "react";
import T9Keyboard from "./T9Keyboard";
import PomodoroTimer from "./PomodoroTimer";

export interface FloatingToolsProps {
  onKeyboardInput: (text: string) => void;
  initialPosition?: { x: number; y: number };
  initialTab?: number; // 0=T9, 1=Pomodoro
  // When true, the whole widget appears dimmed and is not interactive
  dimmed?: boolean;
  // Temporary Kanji tab integration
  kanjiCandidates?: string[]; // up to 10 shown
  onSelectKanji?: (ch: string) => void;
  onClearKanji?: () => void; // called when Erase pressed
}

const containerShadow =
  "0 10px 30px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.02) inset";

// Reuse the T9 sizing for a consistent look
const KEY_SIZE = 56;
const KEY_GAP = 8;

type Palette = {
  bg: string;
  bgSoft: string;
  border: string;
  text: string;
  accent: string;
  highlight: string;
  dim: string;
};

const KanjiCandidatesGrid: React.FC<{
  candidates: string[];
  onSelect: (ch: string) => void;
  onErase: () => void;
  palette: Palette;
}> = ({ candidates, onSelect, onErase, palette }) => {
  const cands = candidates.slice(0, 10);
  const renderKey = (idx: number) => {
    const ch = cands[idx];
    const disabled = !ch;
    return (
      <button
        key={`cand-${idx}`}
        onClick={() => ch && onSelect(ch)}
        disabled={disabled}
        style={{
          width: KEY_SIZE,
          height: KEY_SIZE,
          borderRadius: 10,
          border: `1px solid ${palette.border}`,
          background: palette.bgSoft,
          color: disabled ? palette.dim : palette.text,
          fontSize: 22,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 1px 0 rgba(0,0,0,0.4) inset",
          touchAction: "none",
          cursor: disabled ? "default" : "pointer",
        }}
        title={ch ? `Select ${ch}` : ""}
      >
        {ch ?? ""}
      </button>
    );
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(3, ${KEY_SIZE}px)`,
        gap: KEY_GAP,
      }}
    >
      {/* Rows 1-3: 9 keys */}
      {Array.from({ length: 9 }).map((_, i) => renderKey(i))}
      {/* Row 4, col1: 10th candidate */}
      {renderKey(9)}
      {/* Row 4, col2-3: Erase spanning 2 columns */}
      <button
        onClick={onErase}
        style={{
          gridColumn: "span 2",
          height: KEY_SIZE,
          borderRadius: 10,
          border: `1px solid ${palette.border}`,
          background: "transparent",
          color: "#ffb3b3",
          fontSize: 16,
          fontWeight: 800,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 1px 0 rgba(0,0,0,0.4) inset",
        }}
        title="Erase canvas"
      >
        Erase
      </button>
    </div>
  );
};

const FloatingTools: React.FC<FloatingToolsProps> = ({
  onKeyboardInput,
  initialPosition,
  initialTab = 0,
  dimmed = false,
  kanjiCandidates = [],
  onSelectKanji,
  onClearKanji,
}) => {
  const STORAGE_KEY = "floatingTools.lastPos";
  const getDefaultSize = () => ({ w: 280, h: 360 });
  const loadStoredPos = (): { x: number; y: number } | null => {
    try {
      if (typeof window === "undefined") return null;
      const v = window.localStorage.getItem(STORAGE_KEY);
      if (!v) return null;
      const p = JSON.parse(v);
      if (
        typeof p === "object" &&
        p !== null &&
        typeof p.x === "number" &&
        typeof p.y === "number"
      )
        return { x: p.x, y: p.y };
      return null;
    } catch {
      return null;
    }
  };
  const saveStoredPos = (p: { x: number; y: number }) => {
    try {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    } catch {
      // ignore write errors (e.g., private mode)
    }
  };

  // Initialize position from props, storage, or default bottom-right
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window === "undefined") return { x: 0, y: 0 };
    const stored = loadStoredPos();
    if (initialPosition) return { x: initialPosition.x, y: initialPosition.y };
    if (stored) return stored;
    const size = getDefaultSize();
    return {
      x: Math.max(12, window.innerWidth - size.w - 24),
      y: Math.max(12, window.innerHeight - size.h - 24),
    };
  });
  // 0=T9, 1=Pomodoro, 2=Kanji (temporary), 3=Navigation
  const [activeTab, setActiveTab] = useState<number>(initialTab);
  const [showKanjiTab, setShowKanjiTab] = useState<boolean>(false);
  // Pomodoro tab label: 🍅 when idle, mm:ss when running
  const [pomodoroLabel, setPomodoroLabel] = useState<string>("🍅");
  const [isDocked, setIsDocked] = useState<boolean>(false);
  const dragging = useRef(false);
  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragPointerId = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const prevPosRef = useRef<{ x: number; y: number } | null>(null);

  const palette = useMemo(
    () => ({
      bg: "#2a2652",
      bgSoft: "#242046",
      border: "#4e4893",
      text: "#e9e9f1",
      accent: "#ff79c6",
      highlight: "#3b356e",
      dim: "#b6b3e1",
    }),
    []
  );

  // Determine if the Pomodoro label is a timer string (mm:ss)
  const pomodoroIsTimer = useMemo(
    () => /\d{1,2}:\d{2}/.test(pomodoroLabel),
    [pomodoroLabel]
  );

  // Simple Nav tab: Up/Down buttons dispatch Arrow key events
  const NavTab: React.FC = () => {
    const dispatchNav = (direction: -1 | 1) => {
      const ev = new CustomEvent("yomi:navigateResults", {
        detail: { direction },
      });
      window.dispatchEvent(ev);
    };
    const btnStyle: React.CSSProperties = {
      width: KEY_SIZE,
      height: KEY_SIZE,
      borderRadius: 10,
      border: `1px solid ${palette.border}`,
      background: palette.bgSoft,
      color: palette.text,
      fontSize: 20,
      fontWeight: 800,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 1px 0 rgba(0,0,0,0.4) inset",
      cursor: "pointer",
    };
    return (
      <div
        style={{
          padding: 24,
          display: "grid",
          gridTemplateRows: `repeat(2, ${KEY_SIZE}px)`,
          gap: 24,
          minWidth: KEY_SIZE + 48,
        }}
      >
        <button
          style={btnStyle}
          onClick={(e) => {
            e.stopPropagation();
            dispatchNav(-1);
          }}
          title="Highlight previous (Arrow Up)"
        >
          ▲
        </button>
        <button
          style={btnStyle}
          onClick={(e) => {
            e.stopPropagation();
            dispatchNav(1);
          }}
          title="Highlight next (Arrow Down)"
        >
          ▼
        </button>
      </div>
    );
  };

  // Clamp on resize to keep inside viewport
  useEffect(() => {
    const onResize = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      const w = rect?.width ?? getDefaultSize().w;
      const h = rect?.height ?? getDefaultSize().h;
      if (isDocked) {
        // Force re-render so computed 'top' reflects new viewport size
        setPos((prev) => ({ ...prev }));
      } else {
        const maxX = Math.max(12, window.innerWidth - w - 12);
        const maxY = Math.max(12, window.innerHeight - h - 12);
        setPos((prev) => ({
          x: Math.max(12, Math.min(prev.x, maxX)),
          y: Math.max(12, Math.min(prev.y, maxY)),
        }));
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isDocked]);

  // Auto-show/hide temporary Kanji tab based on candidates
  useEffect(() => {
    const hasCands = (kanjiCandidates?.length ?? 0) > 0;
    if (hasCands) {
      setShowKanjiTab(true);
      setActiveTab(2);
    } else if (showKanjiTab) {
      // If candidates cleared while on Kanji tab, fall back to previous or default
      setShowKanjiTab(false);
      setActiveTab((prev) => (prev === 2 ? 0 : prev));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kanjiCandidates]);

  const clampToViewport = (nx: number, ny: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const w = rect?.width ?? getDefaultSize().w;
    const h = rect?.height ?? getDefaultSize().h;
    const maxX = Math.max(0, window.innerWidth - w);
    const maxY = Math.max(0, window.innerHeight - h);
    return {
      x: Math.min(Math.max(0, nx), maxX),
      y: Math.min(Math.max(0, ny), maxY),
    };
  };

  const onDragPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = true;
    dragPointerId.current = e.pointerId;
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
  const onDragPointerMove = (e: React.PointerEvent) => {
    if (dragging.current) e.preventDefault();
  };
  const onDragPointerUp = (e: React.PointerEvent) => {
    if (dragging.current) e.preventDefault();
  };

  // Persist last undocked position whenever it changes
  useEffect(() => {
    if (!isDocked) saveStoredPos(pos);
  }, [pos, isDocked]);

  return (
    <div
      id="floating-tools"
      ref={containerRef}
      style={{
        position: "fixed",
        left: isDocked ? undefined : pos.x,
        right: isDocked ? 0 : undefined,
        top: isDocked ? "50%" : pos.y,
        transform: isDocked ? "translateY(-50%)" : "none",
        zIndex: 1000,
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        borderRadius: 12,
        // Symmetric horizontal padding when docked to keep contents visually centered
        padding: isDocked ? "8px 4px 8px 4px" : 12,
        boxShadow: containerShadow,
        color: palette.text,
        userSelect: "none",
        touchAction: isDocked ? "auto" : "none",
        opacity: dimmed ? 0.5 : 1,
        pointerEvents: dimmed ? "none" : "auto",
        // keep container tight to the smaller tab bar when docked
        maxWidth: isDocked ? 52 : undefined,
      }}
    >
      {/* Content + vertical tab bar layout */}
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          // Remove inter-column gap when docked so the tab bar centers within the container
          gap: isDocked ? 0 : 8,
        }}
      >
        {/* Left content area (tool content only) */}
        <div
          style={{
            borderRight: isDocked ? "none" : `1px solid ${palette.border}`,
            paddingRight: isDocked ? 0 : 8,
            minWidth: 0,
            width: isDocked ? 0 : "auto",
            overflow: "hidden",
            transition: "width 140ms ease-out, padding-right 140ms ease-out",
            pointerEvents: "auto",
          }}
        >
          {/* Tools body */}
          <div
            style={{
              position: "relative",
            }}
          >
            <div style={{ display: activeTab === 0 ? "block" : "none" }}>
              <T9Keyboard onInput={onKeyboardInput} embedded />
            </div>
            <div style={{ display: activeTab === 1 ? "block" : "none" }}>
              <PomodoroTimer
                onLabelChange={(label) => {
                  // Convert idle label to 🍅, keep timer string when running
                  setPomodoroLabel(/:\d{2}/.test(label) ? label : "🍅");
                }}
              />
            </div>
            {/* Temporary Kanji candidates tab */}
            <div style={{ display: activeTab === 2 ? "block" : "none" }}>
              <KanjiCandidatesGrid
                candidates={kanjiCandidates}
                onSelect={(ch) => {
                  onSelectKanji?.(ch);
                  // Hide temporary tab immediately after selection
                  setShowKanjiTab(false);
                  setActiveTab(0);
                }}
                onErase={() => {
                  onClearKanji?.();
                  setShowKanjiTab(false);
                  setActiveTab(0);
                }}
                palette={palette}
              />
            </div>
            {/* Navigation tab */}
            <div style={{ display: activeTab === 3 ? "block" : "none" }}>
              <NavTab />
            </div>
          </div>
        </div>

        {/* Right vertical tab bar + drag (top), tabs (center), dock toggle (bottom) */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            width: isDocked ? 44 : 36,
            alignSelf: "stretch",
            minHeight: 0,
          }}
        >
          {/* Drag handle (plain 9-dot icon) at top */}
          <div
            ref={headerRef}
            onPointerDown={isDocked ? undefined : onDragPointerDown}
            onPointerMove={isDocked ? undefined : onDragPointerMove}
            onPointerUp={isDocked ? undefined : onDragPointerUp}
            title={isDocked ? "" : "Drag"}
            aria-label="Drag handle"
            style={{
              cursor: isDocked
                ? "default"
                : dragging.current
                ? "grabbing"
                : "grab",
              width: "100%",
              height: isDocked ? 20 : 16,
              background: "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              touchAction: "none",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 3px)",
                gap: 3,
              }}
            >
              {Array.from({ length: 9 }).map((_, i) => (
                <span
                  key={i}
                  style={{
                    width: 3,
                    height: 3,
                    background: palette.dim,
                    borderRadius: "50%",
                    display: "block",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Tabs in the middle */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
            }}
          >
            {[
              { id: 0, label: "📱" },
              { id: 1, label: pomodoroIsTimer ? pomodoroLabel : "🍅" },
              { id: 3, label: "↕️" },
              // Keep 漢 for Kanji tab while active
              ...(showKanjiTab ? [{ id: 2, label: "漢" } as const] : []),
            ].map((t) => (
              <button
                key={t.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTab(t.id);
                }}
                style={{
                  width: isDocked ? 36 : 32,
                  height: isDocked ? 36 : 32,
                  borderRadius: "50%",
                  border: `1px solid ${palette.border}`,
                  background:
                    activeTab === t.id ? palette.bgSoft : "transparent",
                  color: activeTab === t.id ? palette.text : palette.dim,
                  fontWeight: 700,
                  // Slightly smaller font for the Pomodoro timer string so it fits
                  fontSize:
                    t.id === 1 && pomodoroIsTimer ? (isDocked ? 12 : 11) : 18,
                  cursor: "pointer",
                  textAlign: "center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  padding: 0,
                }}
                title={t.label}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Dock toggle at bottom (plain icon) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsDocked((prev) => {
                if (!prev) {
                  // Docking: remember current position
                  prevPosRef.current = { ...pos };
                  saveStoredPos(prevPosRef.current);
                  return true;
                } else {
                  // Undocking: restore saved position and clamp within viewport
                  const fallback = loadStoredPos() ?? prevPosRef.current ?? pos;
                  const restored = clampToViewport(fallback.x, fallback.y);
                  setPos(restored);
                  return false;
                }
              });
            }}
            title={isDocked ? "Restore" : "Minimize"}
            style={{
              width: "100%",
              height: isDocked ? 24 : 20,
              border: "none",
              background: "transparent",
              color: palette.text,
              fontWeight: 800,
              cursor: "pointer",
              lineHeight: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {isDocked ? "+" : "‒"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FloatingTools;
