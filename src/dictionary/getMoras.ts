export const getMoras = (pronunciation: string): string[] => {
  const smallKana = [
    "ゃ",
    "ゅ",
    "ょ",
    "ぅ",
    "ぃ",
    "ャ",
    "ュ",
    "ョ",
    "ァ",
    "ィ",
    "ゥ",
    "ェ",
    "ォ",
  ];
  const moras: string[] = [];
  let currentMora = "";
  for (const char of pronunciation) {
    if (!currentMora || smallKana.includes(char)) {
      currentMora += char;
    } else {
      moras.push(currentMora);
      currentMora = char;
    }
  }
  if (currentMora) moras.push(currentMora);
  return moras;
};
