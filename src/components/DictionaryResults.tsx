import React from "react";
import type { WordEntry } from "../dictionary/search";
import "./DictionaryResults.css";
import { getMoras } from "../dictionary/getMoras";
import { romajiToHiragana } from "../dictionary/romajiToHiragana";
import { katakanaToHiragana } from "../dictionary/katakanaToHiragana";

export type DictionaryResultsProps = {
  entries: WordEntry[];
  maxItems?: number;
  showPitch?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onSelect?: (entry: WordEntry, index: number) => void;
  matchText?: string; // raw input text to highlight within word/pronunciation
  onHighlightChange?: (item: { word: string; meaning: string } | null) => void;
};

const DictionaryResults: React.FC<DictionaryResultsProps> = ({
  entries,
  maxItems,
  showPitch = true,
  className = "",
  style,
  onSelect,
  matchText,
  onHighlightChange,
}) => {
  const list = maxItems ? entries.slice(0, maxItems) : entries;
  const isEmpty = !list || list.length === 0;

  const [activeIndex, setActiveIndex] = React.useState<number>(0);
  const containerRef = React.useRef<HTMLUListElement>(null);
  const itemRefs = React.useRef<(HTMLLIElement | null)[]>([]);

  // Reset selection when list changes
  React.useEffect(() => {
    setActiveIndex(0);
  }, [list.length]);

  // Notify parent when highlight changes
  React.useEffect(() => {
    if (!list.length) return;
    const e = list[Math.max(0, Math.min(activeIndex, list.length - 1))];
    if (!e) return;
    const meaning = e.definitions?.[0] ?? "";
    onHighlightChange?.({ word: e.word, meaning });
  }, [activeIndex, list, onHighlightChange]);

  // Ensure active item is scrolled into view, placed near top
  const scrollActiveIntoView = React.useCallback(() => {
    const container = containerRef.current;
    const el = itemRefs.current[activeIndex];
    if (!container || !el) return;
    const cRect = container.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const isBelow = eRect.bottom > cRect.bottom - 4;
    const isAbove = eRect.top < cRect.top + 4;
    if (isBelow || isAbove) {
      const top = el.offsetTop; // position inside container
      container.scrollTo({ top, behavior: "smooth" });
    }
  }, [activeIndex]);

  React.useEffect(() => {
    scrollActiveIntoView();
  }, [activeIndex, scrollActiveIntoView]);

  // Navigation via custom event dispatched by App and Nav tab
  React.useEffect(() => {
    const onCustom = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as { direction?: number };
      const dir = detail?.direction ?? 0;
      if (!dir) return;
      setActiveIndex((prev) => {
        const next = prev + (dir < 0 ? -1 : 1);
        if (next < 0) return 0;
        if (next >= list.length) return list.length - 1;
        return next;
      });
    };
    window.addEventListener("yomi:navigateResults", onCustom as EventListener);
    return () => {
      window.removeEventListener(
        "yomi:navigateResults",
        onCustom as EventListener
      );
    };
  }, [list.length]);

  if (isEmpty) return null;

  const highlight = (text: string) => {
    if (!matchText) return text;
    const i = text.indexOf(matchText);
    if (i < 0) return text;
    return (
      <>
        {text.slice(0, i)}
        <mark className="dictResults__hl">
          {text.slice(i, i + matchText.length)}
        </mark>
        {text.slice(i + matchText.length)}
      </>
    );
  };

  const highlightPron = (pron: string) => {
    if (!matchText) return pron;
    // First try simple substring
    const simple = highlight(pron);
    if (simple !== pron) return simple;
    // Try normalized match: romaji -> hiragana for query, katakana->hiragana for pron
    const q = romajiToHiragana(matchText.toLowerCase());
    const t = katakanaToHiragana(pron);
    const k = t.indexOf(q);
    if (k < 0) return pron;
    // Assume 1:1 mapping between pron and normalized t for full-width kana
    return (
      <>
        {pron.slice(0, k)}
        <mark className="dictResults__hl">{pron.slice(k, k + q.length)}</mark>
        {pron.slice(k + q.length)}
      </>
    );
  };

  const renderPitch = (word: string, pron: string, accents: number[]) => {
    if (!showPitch) return null;
    if (!accents?.length) return null;
    const p = pron || word;
    const moras = getMoras(p);
    // Render first accent only for simplicity; multiple could be shown with badges
    const accent = accents[0];
    const chips = (
      <span className="dictResults__pitchChips">
        {accents.map((a, idx) => (
          <span className="dictResults__chip" key={idx} title={`accent ${a}`}>
            {a}
          </span>
        ))}
      </span>
    );
    return (
      <span
        className="dictResults__pitchViz"
        title={`pitch: ${accents.join(", ")}`}
      >
        {moras.map((m, idx) => (
          <span key={idx} className={idx === accent ? "downstep" : undefined}>
            {m}
          </span>
        ))}
        {chips}
      </span>
    );
  };

  const parseDefinitions = (defs: string[]) => {
    type Sense = { num?: number; text: string; tags: string[] };
    const allPos = new Set<string>();
    const senses: Sense[] = [];

    const splitNumbered = (s: string): string[] => {
      if (/\(\d+\)/.test(s)) {
        return s.split(/(?=\(\d+\))/g);
      }
      return [s];
    };

    const parseOne = (s: string): Sense => {
      let rest = s.trim();
      let num: number | undefined;
      const tags: string[] = [];
      // Pull leading parenthetical groups
      // e.g., (n)(vs-c)(vt)(1) text -> tags: n, vs-c, vt; num: 1
      while (rest.startsWith("(")) {
        const m = rest.match(/^\(([^)]*)\)\s*/);
        if (!m) break;
        const content = m[1];
        rest = rest.slice(m[0].length).trimStart();
        if (/^\d+$/.test(content)) {
          num = parseInt(content, 10);
        } else if (content) {
          content.split(/\s*,\s*/).forEach((t) => {
            if (t) {
              tags.push(t);
              allPos.add(t);
            }
          });
        }
      }
      return { num, text: rest, tags };
    };

    for (const d of defs) {
      for (const piece of splitNumbered(d)) {
        const sense = parseOne(piece);
        if (sense.text) senses.push(sense);
      }
    }

    return { pos: Array.from(allPos), senses } as const;
  };

  return (
    <ul
      ref={containerRef}
      className={["dictResults", className].filter(Boolean).join(" ")}
      style={style}
    >
      {list.map((e, i) => (
        <li
          key={`${e.word}-${e.pronunciation}-${i}`}
          ref={(el) => {
            itemRefs.current[i] = el;
          }}
          className={[
            "dictResults__item",
            i === activeIndex ? "dictResults__item--active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => {
            setActiveIndex(i);
            onSelect?.(e, i);
          }}
        >
          <div className="dictResults__row">
            <span className="dictResults__word">{highlight(e.word)}</span>
            {e.pronunciation && (
              <span className="dictResults__pron">
                [{highlightPron(e.pronunciation)}]
              </span>
            )}
            {renderPitch(e.word, e.pronunciation, e.pitchAccents)}
          </div>
          {(() => {
            const { pos, senses } = parseDefinitions(e.definitions);
            const hasNumbering = senses.some((s) => s.num !== undefined);
            return (
              <div className="dictResults__defs">
                {hasNumbering ? null : pos.length > 0 ? (
                  <span className="dictResults__pos">
                    {pos.map((t, i) => (
                      <span key={i} className="dictResults__posTag">
                        ({t})
                      </span>
                    ))}
                  </span>
                ) : null}
                {senses.length > 0 ? (
                  <ul className="dictResults__senseList">
                    {senses.map((s, i) => (
                      <li key={i}>
                        {s.tags?.length ? (
                          <span
                            className="dictResults__pos"
                            style={{ marginRight: 6 }}
                          >
                            {s.tags.map((t, j) => (
                              <span key={j} className="dictResults__posTag">
                                ({t})
                              </span>
                            ))}
                          </span>
                        ) : null}
                        <span>{s.text}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span>{e.definitions.join(", ")}</span>
                )}
              </div>
            );
          })()}
        </li>
      ))}
    </ul>
  );
};

export default DictionaryResults;
