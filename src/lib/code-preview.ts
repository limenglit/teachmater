const REPLACEMENT_CHAR = /\uFFFD/g;
const CJK_CHAR = /[\u3400-\u9FFF]/;
const CONTROL_CHAR = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;

function scoreDecodedText(text: string) {
  let score = 0;

  const replacementMatches = text.match(REPLACEMENT_CHAR)?.length ?? 0;
  score -= replacementMatches * 6;

  if (CJK_CHAR.test(text)) score += 3;
  if (CONTROL_CHAR.test(text)) score -= 4;
  if (text.includes('//') || text.includes('/*') || text.includes('#')) score += 1;

  return score;
}

function decodeBuffer(buffer: ArrayBuffer, encoding: string) {
  return new TextDecoder(encoding).decode(buffer).replace(/^\uFEFF/, '');
}

export async function fetchCodePreviewText(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to load code file');
  }

  const buffer = await response.arrayBuffer();
  const candidates = ['utf-8', 'gb18030']
    .map((encoding) => {
      try {
        return {
          encoding,
          text: decodeBuffer(buffer, encoding),
        };
      } catch {
        return null;
      }
    })
    .filter((candidate): candidate is { encoding: string; text: string } => candidate !== null);

  if (candidates.length === 0) {
    return '';
  }

  candidates.sort((left, right) => scoreDecodedText(right.text) - scoreDecodedText(left.text));
  return candidates[0].text;
}