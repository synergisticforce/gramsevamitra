const PUA_START = 0xe000;
const PUA_END = 0xf8ff;

/**
 * Kruti Dev and Bamini often leave ASCII soup such as `dk;kZy;` in the text layer.
 * A high share of Private Use Area characters is the other common broken font case.
 */
export function hasCorruptedLegacyIndicFont(text: string): boolean {
  const compact = text.replace(/\s+/g, '');
  if (compact.length < 12) return false;

  let pua = 0;
  for (const char of compact) {
    const code = char.codePointAt(0) ?? 0;
    if (code >= PUA_START && code <= PUA_END) pua += 1;
  }
  if (pua / compact.length > 0.15) return true;

  const words = text.split(/\s+/).filter((word) => word.length >= 3);
  if (words.length < 4) return false;
  const gibberish = words.filter((word) => /[A-Za-z];[A-Za-z]/.test(word) || /;[A-Za-z]{2,}/.test(word)).length;
  return gibberish / words.length > 0.15;
}
