import { deinflect } from "./deinflect";
import { getPitchAccents } from "./getPitchAccents";
import { katakanaToHiragana } from "./katakanaToHiragana";
import { romajiToHiragana } from "./romajiToHiragana";

export type WordEntry = {
  word: string;
  pronunciation: string;
  definitions: string[];
  pitchAccents: number[];
};

export type WordSearchResult = {
  selectedTextLength: number;
  wordEntries: WordEntry[];
};

export type Dictionaries = {
  wordDict: string;
  wordDictIndex: string;
  difReasons: string[];
  difRules: import("./deinflect").DeinflectionRuleGroup[];
  pitchData: string[];
};

export const searchWord = (
  dictionaries: Dictionaries,
  text: string
): WordSearchResult => {
  const { wordDict, wordDictIndex, difReasons, difRules, pitchData } =
    dictionaries;
  const wordEntries: WordEntry[] = [];
  const searchedWords = new Set<string>();
  let selectedTextLength = 1;
  for (; text.length > 0; text = text.slice(0, -1)) {
    const deinflections = deinflect(
      difReasons,
      difRules,
      katakanaToHiragana(romajiToHiragana(text))
    );
    for (const { word } of deinflections) {
      if (searchedWords.has(word)) continue;
      searchedWords.add(word);
      let lo = 0;
      let hi = wordDictIndex.length - 1;
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        const midLineIndex = wordDictIndex.lastIndexOf("\n", mid) + 1;
        const midLineEndIndex = wordDictIndex.indexOf("\n", midLineIndex);
        const midLine = wordDictIndex.slice(midLineIndex, midLineEndIndex);
        const [midWord, ...midIndexStrings] = midLine.split(",");
        if (!midWord) break;
        const midIndexes = midIndexStrings.map(Number);
        if (midIndexes.some(isNaN)) break;
        const wordHiragana = katakanaToHiragana(romajiToHiragana(word));
        if (midWord === wordHiragana) {
          const newEntries = midIndexes
            .map((widx) => wordDict.slice(widx, wordDict.indexOf("\n", widx)))
            .map(parseWordDictLine)
            .filter(Boolean) as WordEntry[];

          for (const entry of newEntries) {
            entry.pitchAccents = getPitchAccents(
              pitchData,
              entry.word,
              entry.pronunciation
            );
          }

          wordEntries.push(...newEntries);
          selectedTextLength = Math.max(selectedTextLength, text.length);
          break;
        } else if (midWord < wordHiragana) {
          lo = midLineEndIndex + 1;
        } else {
          hi = midLineIndex - 1;
        }
      }
    }
  }
  return { selectedTextLength, wordEntries };
};

const parseWordDictLine = (line: string): WordEntry | null => {
  const match = line.match(/^(.+?)\s+(?:\[(.*?)\])?\s*\/(.+)\//);
  const word = match?.[1];
  const pronunciation = match?.[2] ?? "";
  const definitions = match?.[3]?.split("/");
  if (!word || !definitions) {
    return null;
  }
  return {
    word,
    pronunciation,
    definitions,
    pitchAccents: [],
  };
};

export const loadWordDict = async (): Promise<{
  wordDict: string;
  wordDictIndex: string;
}> => {
  const [wordDict, wordDictIndex] = await Promise.all([
    fetch("/dictionaries/word-dict.txt")
      .then((res) => res.text())
      // Normalize to LF so offsets in the index match
      .then((t) => t.replace(/\r/g, "")),
    fetch("/dictionaries/word-dict-index.txt").then((res) => res.text()),
  ]);
  return { wordDict, wordDictIndex };
};
