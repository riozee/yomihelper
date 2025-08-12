export type Deinflection = {
  word: string;
  type: number;
  reason: string;
};

export type DeinflectionRuleGroup = {
  fromLength: number;
  rules: DeinflectionRule[];
};

export type DeinflectionRule = {
  from: string;
  to: string;
  typeMask: number;
  reasonIndex: number;
};

export type DeinflectionData = {
  difReasons: string[];
  difRules: DeinflectionRuleGroup[];
};

export const deinflect = (
  difReasons: string[],
  difRuleGroups: DeinflectionRuleGroup[],
  word: string
): Deinflection[] => {
  const results: Deinflection[] = [{ word, type: 0xff, reason: "" }];
  const wordToResultIndex: Record<string, number> = { [word]: 0 };

  for (const result of results) {
    const { word, type } = result;

    for (const difRuleGroup of difRuleGroups) {
      if (word.length < difRuleGroup.fromLength) continue;

      const end = word.slice(-difRuleGroup.fromLength);
      for (const rule of difRuleGroup.rules) {
        if ((type & rule.typeMask) === 0 || end !== rule.from) continue;

        const newWord = word.slice(0, word.length - rule.from.length) + rule.to;
        if (newWord.length <= 0) continue;

        const wordResultIndex = wordToResultIndex[newWord];
        const deinflection =
          wordResultIndex !== undefined ? results[wordResultIndex] : undefined;
        if (deinflection) {
          deinflection.type |= rule.typeMask >> 8;
          continue;
        }

        wordToResultIndex[newWord] = results.length;
        const reason = difReasons[rule.reasonIndex];
        if (!reason) break;

        results.push({
          word: newWord,
          type: rule.typeMask >> 8,
          reason: result.reason ? reason + " &lt; " + result.reason : reason,
        });
      }
    }
  }

  return results;
};

export const parseDeinflectionData = (buffer: string[]): DeinflectionData => {
  let currentLength = -1;
  let group: DeinflectionRuleGroup = { fromLength: currentLength, rules: [] };
  const difReasons: string[] = [];
  const difRules: DeinflectionRuleGroup[] = [];

  const lines = buffer.values();
  lines.next(); // skip header

  for (const line of lines) {
    const ruleOrReason = line.split("\t");
    const [fromOrRule, to, typeMask, reasonIndex] = ruleOrReason;

    if (fromOrRule && to && typeMask && reasonIndex) {
      const difRule: DeinflectionRule = {
        from: fromOrRule,
        to,
        typeMask: parseInt(typeMask),
        reasonIndex: parseInt(reasonIndex),
      };

      if (currentLength !== difRule.from.length) {
        currentLength = difRule.from.length;
        group = { fromLength: currentLength, rules: [] };
        difRules.push(group);
      }
      group.rules.push(difRule);
    } else if (fromOrRule) {
      difReasons.push(fromOrRule);
    }
  }

  return { difReasons, difRules };
};

export const loadDeinflectionData = async (): Promise<DeinflectionData> => {
  const buffer = (
    await fetch("/dictionaries/deinflect.txt").then((res) => res.text())
  )
    .replace(/\r/g, "")
    .split("\n");
  return parseDeinflectionData(buffer);
};
