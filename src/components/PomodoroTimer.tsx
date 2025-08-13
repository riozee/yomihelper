import React, { useEffect, useMemo, useRef, useState } from "react";

export interface PomodoroTimerProps {
  // Optional: initial durations in minutes
  focusMinutes?: number;
  breakMinutes?: number;
  // Optional: notify parent to update a floating tab label
  onLabelChange?: (label: string) => void;
}

type Phase = "focus" | "break";

const format = (s: number) => {
  const m = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const r = Math.floor(s % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${r}`;
};

const PomodoroTimer: React.FC<PomodoroTimerProps> = ({
  focusMinutes = 25,
  breakMinutes = 5,
  onLabelChange,
}) => {
  const [phase, setPhase] = useState<Phase>("focus");
  const [secondsLeft, setSecondsLeft] = useState(focusMinutes * 60);
  const [running, setRunning] = useState(false);
  const lastTick = useRef<number | null>(null);

  useEffect(() => {
    // Reset seconds when durations change and not running
    if (!running) {
      setSecondsLeft(phase === "focus" ? focusMinutes * 60 : breakMinutes * 60);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusMinutes, breakMinutes]);

  useEffect(() => {
    if (!running) {
      lastTick.current = null;
      return;
    }
    let anim = 0;
    const step = (t: number) => {
      if (lastTick.current == null) lastTick.current = t;
      const dt = Math.max(0, t - lastTick.current);
      if (dt >= 250) {
        const dec = Math.floor(dt / 1000);
        if (dec > 0) {
          setSecondsLeft((prev) => Math.max(0, prev - dec));
          lastTick.current = t;
        }
      }
      anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
    return () => cancelAnimationFrame(anim);
  }, [running]);

  useEffect(() => {
    if (secondsLeft === 0) {
      // Auto switch phase and start next phase
      const nextPhase: Phase = phase === "focus" ? "break" : "focus";
      setPhase(nextPhase);
      setSecondsLeft(
        nextPhase === "focus" ? focusMinutes * 60 : breakMinutes * 60
      );
      setRunning(false); // pause at phase change
      // Optional: basic beep
      try {
        const AC: typeof AudioContext | undefined =
          (window as unknown as { AudioContext?: typeof AudioContext })
            .AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (AC) {
          const ctx = new AC();
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g);
          g.connect(ctx.destination);
          o.type = "sine";
          o.frequency.value = 880;
          g.gain.value = 0.0001;
          o.start();
          const now = ctx.currentTime;
          g.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
          o.stop(now + 0.25);
        }
      } catch {
        // ignore audio errors (autoplay policies, etc.)
      }
    }
  }, [secondsLeft, phase, focusMinutes, breakMinutes]);

  // Inform parent about desired label (remaining time when running)
  useEffect(() => {
    if (!onLabelChange) return;
    onLabelChange(running ? format(secondsLeft) : "Pomodoro");
  }, [running, secondsLeft, onLabelChange]);

  const palette = useMemo(
    () => ({
      bgSoft: "#242046",
      border: "#4e4893",
      text: "#e9e9f1",
      accent: "#ff79c6",
      dim: "#b6b3e1",
    }),
    []
  );

  const toggle = () => setRunning((v) => !v);
  const reset = () => {
    setRunning(false);
    setSecondsLeft(phase === "focus" ? focusMinutes * 60 : breakMinutes * 60);
  };
  const switchPhase = () => {
    const next: Phase = phase === "focus" ? "break" : "focus";
    setPhase(next);
    setRunning(false);
    setSecondsLeft(next === "focus" ? focusMinutes * 60 : breakMinutes * 60);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span
          style={{
            padding: "2px 8px",
            borderRadius: 6,
            border: `1px solid ${palette.border}`,
            background: palette.bgSoft,
            color: palette.text,
            fontWeight: 600,
          }}
        >
          {phase === "focus" ? "Focus" : "Break"}
        </span>
        <button
          onClick={switchPhase}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: `1px solid ${palette.border}`,
            background: "transparent",
            color: palette.dim,
            cursor: "pointer",
          }}
        >
          Switch
        </button>
      </div>
      <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: 1 }}>
        {format(secondsLeft)}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={toggle}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: `1px solid ${palette.border}`,
            background: palette.bgSoft,
            color: palette.text,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {running ? "Pause" : "Start"}
        </button>
        <button
          onClick={reset}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: `1px solid ${palette.border}`,
            background: "transparent",
            color: palette.dim,
            cursor: "pointer",
          }}
        >
          Reset
        </button>
      </div>
      <div style={{ fontSize: 12, color: palette.dim }}>
        Default durations: {focusMinutes}m / {breakMinutes}m
      </div>
    </div>
  );
};

export default PomodoroTimer;
