import { useEffect, useRef, useState } from "react";

type Props = {
  onSelectKanji: (ch: string) => void;
  className?: string;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const KanjiCanvas: any | undefined;
}

const CANVAS_ID = "kanji-recognizer-canvas";

export default function KanjiRecognizer({ onSelectKanji, className }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokeTimer = useRef<number | null>(null);
  const [candidates, setCandidates] = useState<string[]>([]);

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
            runRecognition();
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
      setCandidates(list);
    } catch {
      // ignore recognition errors
    }
  };

  const clearCanvas = () => {
    if (typeof KanjiCanvas !== "undefined") {
      try {
        KanjiCanvas.erase(CANVAS_ID);
      } catch {
        // ignore
      }
    }
    setCandidates([]);
  };

  const handleSelect = (ch: string) => {
    onSelectKanji(ch);
    clearCanvas();
  };

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: "transparent",
      }}
    >
      <canvas
        id={CANVAS_ID}
        ref={canvasRef}
        style={{
          display: "block",
          background: "transparent",
          touchAction: "none",
        }}
      />

      {candidates.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: "#242047cc",
            color: "#fff",
            backdropFilter: "blur(4px)",
            border: "1px solid #3a3569",
            borderRadius: 8,
            padding: 8,
            maxWidth: "calc(100% - 24px)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {candidates.map((c) => (
              <button
                key={c}
                onClick={() => handleSelect(c)}
                style={{
                  fontSize: 24,
                  lineHeight: 1,
                  padding: "6px 10px",
                  background: "#36306d",
                  color: "#fff",
                  border: "1px solid #4e4893",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                {c}
              </button>
            ))}
            <button
              onClick={() => clearCanvas()}
              style={{
                fontSize: 14,
                padding: "6px 10px",
                background: "transparent",
                color: "#ffb3b3",
                border: "1px solid #6b2d2d",
                borderRadius: 6,
                cursor: "pointer",
                marginLeft: "auto",
              }}
              title="Erase canvas"
            >
              Erase
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
