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
};

const DictionaryResults: React.FC<DictionaryResultsProps> = ({
  entries,
  maxItems,
  showPitch = true,
  className = "",
  style,
  onSelect,
  matchText,
}) => {
  const list = maxItems ? entries.slice(0, maxItems) : entries;
  const isEmpty = !list || list.length === 0;

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
      className={["dictResults", className].filter(Boolean).join(" ")}
      style={style}
    >
      {list.map((e, i) => (
        <li
          key={`${e.word}-${e.pronunciation}-${i}`}
          className={["dictResults__item"].join(" ")}
          onClick={() => onSelect?.(e, i)}
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
