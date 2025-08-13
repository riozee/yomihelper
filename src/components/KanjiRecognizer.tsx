import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export type KanjiRecognizerHandle = {
  // Forward external pointer events to the underlying KanjiCanvas
  forwardPointer: (
    type: "down" | "move" | "up",
    clientX: number,
    clientY: number
  ) => void;
  clear: () => void;
};

type Props = {
  className?: string;
  // When true, render as a full-screen overlay that captures input
  overlayActive?: boolean;
  onCandidates?: (cands: string[]) => void;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const KanjiCanvas: any | undefined;
}

const CANVAS_ID = "kanji-recognizer-canvas";

const KanjiRecognizer = forwardRef<KanjiRecognizerHandle, Props>(
  ({ className, overlayActive = false, onCandidates }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const strokeTimer = useRef<number | null>(null);
    // Candidate list is emitted via onCandidates; no internal render state here
    const readyRef = useRef(false);
    const runRecognitionRef = useRef<() => void>(() => {});

    // Load scripts lazily and init canvas
    useEffect(() => {
      let disposed = false;

      const load = async () => {
        // Load core then patterns in order
        // @ts-expect-error no types for these JS modules
        await import("../kanjicanvas/kanji-canvas.js");
        // @ts-expect-error no types for these JS modules
        await import("../kanjicanvas/ref-patterns.js");
        if (disposed) return;

        // Initialize canvas
        if (typeof KanjiCanvas !== "undefined") {
          KanjiCanvas.init(CANVAS_ID);

          // Mouse/touch hooks to debounce recognition after last stroke
          const canvas = canvasRef.current!;
          // Disable stroke numbers to keep UI clean
          canvas.dataset.strokeNumbers = "false";

          // Use fixed stroke color
          const primaryColor = "#ff79c6";
          // Unify stroke colors for redraws
          KanjiCanvas.strokeColors = new Array(30).fill(primaryColor);
          // Ensure live drawing uses our color even if not provided
          const originalDraw = KanjiCanvas.draw.bind(KanjiCanvas);
          KanjiCanvas.draw = function (id: string) {
            return originalDraw(id, primaryColor);
          };
          // Set dot fillStyle for initial tap
          try {
            const ctx: CanvasRenderingContext2D | undefined =
              KanjiCanvas["ctx_" + CANVAS_ID];
            if (ctx) {
              ctx.fillStyle = primaryColor;
              ctx.strokeStyle = primaryColor;
            }
          } catch {
            // ignore
          }
          const scheduleRecognize = () => {
            if (strokeTimer.current) window.clearTimeout(strokeTimer.current);
            strokeTimer.current = window.setTimeout(() => {
              runRecognitionRef.current();
            }, 200);
          };
          const cancelScheduled = () => {
            if (strokeTimer.current) window.clearTimeout(strokeTimer.current);
          };

          canvas.addEventListener("mouseup", scheduleRecognize);
          canvas.addEventListener("touchend", scheduleRecognize, {
            passive: true,
          });
          canvas.addEventListener("mousedown", cancelScheduled);
          canvas.addEventListener("touchstart", cancelScheduled, {
            passive: true,
          });

          // Resize handling to keep canvas crisp and fill container
          const ro = new ResizeObserver(() => {
            resizeCanvasToContainer();
          });
          if (containerRef.current) ro.observe(containerRef.current);

          // Initial size
          resizeCanvasToContainer();

          readyRef.current = true;

          // Cleanup
          return () => {
            canvas.removeEventListener("mouseup", scheduleRecognize);
            canvas.removeEventListener(
              "touchend",
              scheduleRecognize as EventListener
            );
            canvas.removeEventListener("mousedown", cancelScheduled);
            canvas.removeEventListener(
              "touchstart",
              cancelScheduled as EventListener
            );
            ro.disconnect();
          };
        }
      };

      const cleanupPromise = load();
      return () => {
        disposed = true;
        if (strokeTimer.current) window.clearTimeout(strokeTimer.current);
        // await dynamic cleanup if needed
        void cleanupPromise;
      };
    }, []);

    const resizeCanvasToContainer = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const targetW = Math.max(1, Math.floor(rect.width * dpr));
      const targetH = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
        // Also style size in CSS pixels
        canvas.style.width = `${Math.floor(rect.width)}px`;
        canvas.style.height = `${Math.floor(rect.height)}px`;
        // Redraw existing strokes with new size
        if (typeof KanjiCanvas !== "undefined") {
          KanjiCanvas["w_" + CANVAS_ID] = canvas.width;
          KanjiCanvas["h_" + CANVAS_ID] = canvas.height;
          // Scale context so library's CSS pixel coordinates match device pixels
          // No context transform here; event coordinates are scaled instead
          try {
            KanjiCanvas.redraw(CANVAS_ID);
          } catch {
            // ignore redraw errors during resize
          }
        }
      }
    };

    const runRecognition = () => {
      if (typeof KanjiCanvas === "undefined") return;
      const pattern = KanjiCanvas["recordedPattern_" + CANVAS_ID];
      if (!pattern || pattern.length === 0) return;
      try {
        const out: string = KanjiCanvas.recognize(CANVAS_ID);
        // Returns a string of candidates separated by spaces
        const list = (out || "")
          .trim()
          .split(/\s+/)
          .filter((c) => c && c.length > 0)
          .slice(0, 12);
        try {
          onCandidates?.(list);
        } catch {
          // ignore callback errors
        }
      } catch {
        // ignore recognition errors
      }
    };

    // Keep a stable reference for use inside event handlers without re-subscribing
    useEffect(() => {
      runRecognitionRef.current = runRecognition;
    });

    const clearCanvas = () => {
      if (typeof KanjiCanvas !== "undefined") {
        try {
          KanjiCanvas.erase(CANVAS_ID);
        } catch {
          // ignore
        }
      }
      try {
        onCandidates?.([]);
      } catch {
        // ignore
      }
    };

    // Imperative API: forward external pointer events to the canvas recognizer
    useImperativeHandle(ref, () => ({
      forwardPointer: (type: "down" | "move" | "up", clientX, clientY) => {
        // Ensure scripts and canvas are ready
        if (typeof KanjiCanvas === "undefined" || !readyRef.current) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        // Create a minimal event-like object with client coordinates
        const evt = { clientX, clientY } as MouseEvent;
        try {
          if (type === "down") KanjiCanvas.findxy("down", evt, CANVAS_ID);
          else if (type === "move") KanjiCanvas.findxy("move", evt, CANVAS_ID);
          else if (type === "up") {
            KanjiCanvas.findxy("up", evt, CANVAS_ID);
            // Schedule recognition right after pointer up
            if (strokeTimer.current) window.clearTimeout(strokeTimer.current);
            strokeTimer.current = window.setTimeout(() => {
              runRecognitionRef.current();
            }, 50);
          }
        } catch {
          // ignore
        }
      },
      clear: () => {
        clearCanvas();
      },
    }));

    // When overlay is shown, ensure canvas matches viewport size
    useEffect(() => {
      if (!overlayActive) return;
      resizeCanvasToContainer();
    }, [overlayActive]);

    return (
      <div
        ref={containerRef}
        className={className}
        style={{
          // Always fixed so it never impacts layout even when inactive
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100vh",
          // No visual dimming; keep fully transparent even when capturing input
          background: "transparent",
          // Let overlay capture events to block underlying UI while active
          pointerEvents: overlayActive ? "auto" : "none",
          // Disable browser scrolling/zooming while drawing
          touchAction: overlayActive ? "none" : "auto",
          overscrollBehavior: overlayActive ? "none" : undefined,
          zIndex: 900,
        }}
      >
        <canvas
          id={CANVAS_ID}
          ref={canvasRef}
          style={{
            position: "absolute",
            inset: 0,
            display: "block",
            background: "transparent",
            touchAction: "none",
            // Disable native event handling to avoid double-processing; we forward programmatically
            pointerEvents: "none",
          }}
        />

        {/* Candidate UI is handled by FloatingTools; this overlay only captures drawing. */}
      </div>
    );
  }
);

export default KanjiRecognizer;
