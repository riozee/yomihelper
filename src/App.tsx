import "./App.css";
import KeyboardInput from "./components/KeyboardInput";
import { useEffect, useRef, useState } from "react";
import DictionaryResults from "./components/DictionaryResults";
import KanjiRecognizer from "./components/KanjiRecognizer";
import {
  loadWordDict,
  searchWord,
  type Dictionaries,
  type WordEntry,
} from "./dictionary/search";
import { loadDeinflectionData } from "./dictionary/deinflect";
import { loadPitchData } from "./dictionary/getPitchAccents";
import T9Keyboard from "./components/T9Keyboard";

function App() {
  // Centralized text state - kept at top level to be shared across multiple components
  // This allows any child component to read and modify the keyboard input text
  const [inputValue, setInputValue] = useState("");
  const [entries, setEntries] = useState<WordEntry[]>([]);
  const [dictionaries, setDictionaries] = useState<Dictionaries | null>(null);
  const debounceTimer = useRef<number | null>(null);

  const handleTextChange = (text: string) => {
    console.log("Current text:", text);
    setInputValue(text);
  };

  // Load dictionary data once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ wordDict, wordDictIndex }, { difReasons, difRules }, pitchData] =
        await Promise.all([
          loadWordDict(),
          loadDeinflectionData(),
          loadPitchData(),
        ]);
      if (cancelled) return;
      setDictionaries({
        wordDict,
        wordDictIndex,
        difReasons,
        difRules,
        pitchData,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced search on input changes
  useEffect(() => {
    if (!dictionaries) return; // wait until loaded
    if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => {
      const cleaned = inputValue.replace(/\s/g, "");
      const res = searchWord(dictionaries, cleaned);
      setEntries(res.wordEntries);
    }, 150);
    return () => {
      if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    };
  }, [inputValue, dictionaries]);

  return (
    <div
      className="app"
      style={{ display: "flex", width: "100%", height: "100vh" }}
    >
      {/* Left side: controls and dictionary results */}
      <div style={{ flex: 1, minWidth: 0, padding: 20, position: "relative" }}>
        <div style={{ position: "absolute", top: 20, left: 20, right: 20 }}>
          <KeyboardInput value={inputValue} onTextChange={handleTextChange} />
          {!dictionaries ? (
            <div style={{ color: "#b4b4b4", marginTop: 8 }}>
              Loading dictionary…
            </div>
          ) : null}
          <DictionaryResults entries={entries} matchText={inputValue.trim()} />
        </div>
      </div>
      {/* Right side: full-height kanji canvas */}
      <div style={{ flex: 1, minWidth: 0, borderLeft: "1px solid #2b2850" }}>
        <KanjiRecognizer
          onSelectKanji={(ch) => setInputValue((prev) => prev + ch)}
        />
      </div>
      {/* Floating draggable T9 keyboard */}
      <T9Keyboard
        onInput={(txt) => {
          setInputValue((prev) => {
            if (txt === "\b") return prev.slice(0, -1);
            if (txt === "{dakuten}" || txt === "{handakuten}") {
              if (!prev) return prev;
              const type =
                txt === "{dakuten}" ? "dakuten" : ("handakuten" as const);
              const modified = applyVoicingModifier(prev, type);
              return modified;
            }
            return prev + txt;
          });
        }}
      />
    </div>
  );
}

export default App;

// --- Utilities to apply dakuten/handakuten on last kana ---
type VoicingType = "dakuten" | "handakuten";

// Mappings for hiragana
const DAKUTEN_HIRA: Record<string, string> = {
  か: "が",
  き: "ぎ",
  く: "ぐ",
  け: "げ",
  こ: "ご",
  さ: "ざ",
  し: "じ",
  す: "ず",
  せ: "ぜ",
  そ: "ぞ",
  た: "だ",
  ち: "ぢ",
  つ: "づ",
  て: "で",
  と: "ど",
  は: "ば",
  ひ: "び",
  ふ: "ぶ",
  へ: "べ",
  ほ: "ぼ",
  う: "ゔ",
};
const DAKUTEN_HIRA_REV: Record<string, string> = Object.fromEntries(
  Object.entries(DAKUTEN_HIRA).map(([k, v]) => [v, k])
);

const HANDAKUTEN_HIRA: Record<string, string> = {
  は: "ぱ",
  ひ: "ぴ",
  ふ: "ぷ",
  へ: "ぺ",
  ほ: "ぽ",
};
const HANDAKUTEN_HIRA_REV: Record<string, string> = Object.fromEntries(
  Object.entries(HANDAKUTEN_HIRA).map(([k, v]) => [v, k])
);

// Mappings for katakana (in case user input includes them)
const DAKUTEN_KATA: Record<string, string> = {
  カ: "ガ",
  キ: "ギ",
  ク: "グ",
  ケ: "ゲ",
  コ: "ゴ",
  サ: "ザ",
  シ: "ジ",
  ス: "ズ",
  セ: "ゼ",
  ソ: "ゾ",
  タ: "ダ",
  チ: "ヂ",
  ツ: "ヅ",
  テ: "デ",
  ト: "ド",
  ハ: "バ",
  ヒ: "ビ",
  フ: "ブ",
  ヘ: "ベ",
  ホ: "ボ",
  ウ: "ヴ",
};
const DAKUTEN_KATA_REV: Record<string, string> = Object.fromEntries(
  Object.entries(DAKUTEN_KATA).map(([k, v]) => [v, k])
);

const HANDAKUTEN_KATA: Record<string, string> = {
  ハ: "パ",
  ヒ: "ピ",
  フ: "プ",
  ヘ: "ペ",
  ホ: "ポ",
};
const HANDAKUTEN_KATA_REV: Record<string, string> = Object.fromEntries(
  Object.entries(HANDAKUTEN_KATA).map(([k, v]) => [v, k])
);

function applyVoicingModifier(text: string, type: VoicingType): string {
  if (!text) return text;
  const last = [...text].pop()!; // handle surrogate pairs if any
  const base = text.slice(0, text.length - last.length);

  if (type === "dakuten") {
    // Special cycle for つ/ツ with dakuten key: つ -> っ -> づ -> つ ...
    if (last === "つ") return base + "っ";
    if (last === "っ") return base + "づ";
    if (last === "づ") return base + "つ";
    if (last === "ツ") return base + "ッ";
    if (last === "ッ") return base + "ヅ";
    if (last === "ヅ") return base + "ツ";

    // Small kana toggle for や/ゆ/よ and katakana counterparts with dakuten key
    const SMALL_TOGGLE: Record<string, string> = {
      や: "ゃ",
      ゆ: "ゅ",
      よ: "ょ",
      ヤ: "ャ",
      ユ: "ュ",
      ヨ: "ョ",
      ゃ: "や",
      ゅ: "ゆ",
      ょ: "よ",
      ャ: "ヤ",
      ュ: "ユ",
      ョ: "ヨ",
    };
    if (SMALL_TOGGLE[last]) return base + SMALL_TOGGLE[last];

    // Handakuten -> Dakuten for h-row
    if (HANDAKUTEN_HIRA_REV[last])
      return base + DAKUTEN_HIRA[HANDAKUTEN_HIRA_REV[last]];
    if (HANDAKUTEN_KATA_REV[last])
      return base + DAKUTEN_KATA[HANDAKUTEN_KATA_REV[last]];
    // If currently dakuten on h-row (e.g., ば/ビ), convert to handakuten (ぱ/ピ)
    if (DAKUTEN_HIRA_REV[last] && HANDAKUTEN_HIRA[DAKUTEN_HIRA_REV[last]])
      return base + HANDAKUTEN_HIRA[DAKUTEN_HIRA_REV[last]];
    if (DAKUTEN_KATA_REV[last] && HANDAKUTEN_KATA[DAKUTEN_KATA_REV[last]])
      return base + HANDAKUTEN_KATA[DAKUTEN_KATA_REV[last]];
    // For non h-row dakuten, toggle to base on repeated press
    if (DAKUTEN_HIRA_REV[last]) return base + DAKUTEN_HIRA_REV[last];
    if (DAKUTEN_KATA_REV[last]) return base + DAKUTEN_KATA_REV[last];
    // Apply dakuten to base
    if (DAKUTEN_HIRA[last]) return base + DAKUTEN_HIRA[last];
    if (DAKUTEN_KATA[last]) return base + DAKUTEN_KATA[last];
    return text;
  } else {
    // handakuten
    // Dakuten -> Handakuten for h-row
    if (DAKUTEN_HIRA_REV[last] && HANDAKUTEN_HIRA[DAKUTEN_HIRA_REV[last]])
      return base + HANDAKUTEN_HIRA[DAKUTEN_HIRA_REV[last]];
    if (DAKUTEN_KATA_REV[last] && HANDAKUTEN_KATA[DAKUTEN_KATA_REV[last]])
      return base + HANDAKUTEN_KATA[DAKUTEN_KATA_REV[last]];
    // Toggle handakuten if already present
    if (HANDAKUTEN_HIRA_REV[last]) return base + HANDAKUTEN_HIRA_REV[last];
    if (HANDAKUTEN_KATA_REV[last]) return base + HANDAKUTEN_KATA_REV[last];
    // Apply handakuten to base h-row
    if (HANDAKUTEN_HIRA[last]) return base + HANDAKUTEN_HIRA[last];
    if (HANDAKUTEN_KATA[last]) return base + HANDAKUTEN_KATA[last];
    return text;
  }
}
