/**
 * Word frequency analysis and word cloud layout utilities.
 * Supports Chinese (character/bigram) and Latin (space-delimited) text.
 */

// Common stop words to filter out
const STOP_WORDS_ZH = new Set('的了是在我有和人这中大为上个国以不会就到说时要没出也得里后自以为去那对过能还那么好也就被与从而其他但如果对于可以所以一些因为已经这个那个什么怎么没有不是这些那些可能已经现在就是也是但是所有如何为什么一个两个三个四个五个'.match(/../g) || []);
const STOP_WORDS_EN = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'because', 'but', 'and', 'or', 'if', 'while', 'about', 'up', 'it', 'its', 'this', 'that', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'they', 'them', 'their', 'what', 'which', 'who', 'whom']);

/** Check if a character is CJK */
function isCJK(ch: string): boolean {
  const code = ch.charCodeAt(0);
  return (code >= 0x4E00 && code <= 0x9FFF) || (code >= 0x3400 && code <= 0x4DBF);
}

/** Simple tokenizer: splits CJK into bigrams/single chars, Latin into words */
export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  // Extract Latin words
  const latinWords = text.match(/[a-zA-Z\u00C0-\u024F]{2,}/g) || [];
  latinWords.forEach(w => {
    const lower = w.toLowerCase();
    if (!STOP_WORDS_EN.has(lower)) tokens.push(lower);
  });

  // Extract CJK bigrams and single chars
  const cjkChars: string[] = [];
  for (const ch of text) {
    if (isCJK(ch)) cjkChars.push(ch);
    else {
      // Process accumulated CJK
      if (cjkChars.length > 0) {
        processCJK(cjkChars, tokens);
        cjkChars.length = 0;
      }
    }
  }
  if (cjkChars.length > 0) processCJK(cjkChars, tokens);

  return tokens;
}

function processCJK(chars: string[], tokens: string[]) {
  // Generate both bigrams and single chars, prefer bigrams
  if (chars.length === 1) {
    if (!STOP_WORDS_ZH.has(chars[0])) tokens.push(chars[0]);
    return;
  }
  for (let i = 0; i < chars.length - 1; i++) {
    const bigram = chars[i] + chars[i + 1];
    if (!STOP_WORDS_ZH.has(bigram)) tokens.push(bigram);
  }
}

/** Count word frequencies */
export function countFrequencies(texts: string[], maxWords = 80): WordItem[] {
  const freq: Record<string, number> = {};
  texts.forEach(text => {
    tokenize(text).forEach(token => {
      freq[token] = (freq[token] || 0) + 1;
    });
  });

  return Object.entries(freq)
    .filter(([, count]) => count >= 2) // At least 2 occurrences
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxWords)
    .map(([word, count]) => ({ word, count }));
}

export interface WordItem {
  word: string;
  count: number;
}

export interface PositionedWord extends WordItem {
  x: number;
  y: number;
  fontSize: number;
  rotation: number;
  color: string;
}

export const CLOUD_THEMES: Record<string, { name: string; colors: string[]; bg: string }> = {
  ocean: {
    name: '🌊',
    colors: ['hsl(200,80%,45%)', 'hsl(220,70%,50%)', 'hsl(190,65%,40%)', 'hsl(210,60%,55%)', 'hsl(180,55%,45%)', 'hsl(230,50%,55%)', 'hsl(195,70%,38%)', 'hsl(215,65%,48%)'],
    bg: '#f0f7ff',
  },
  sunset: {
    name: '🌅',
    colors: ['hsl(15,85%,50%)', 'hsl(35,80%,50%)', 'hsl(350,70%,55%)', 'hsl(25,75%,45%)', 'hsl(5,65%,50%)', 'hsl(45,70%,48%)', 'hsl(340,60%,50%)', 'hsl(20,90%,42%)'],
    bg: '#fff8f0',
  },
  forest: {
    name: '🌿',
    colors: ['hsl(140,55%,38%)', 'hsl(160,50%,40%)', 'hsl(120,45%,35%)', 'hsl(80,50%,42%)', 'hsl(100,40%,38%)', 'hsl(150,55%,32%)', 'hsl(170,45%,40%)', 'hsl(90,50%,36%)'],
    bg: '#f0fff4',
  },
  neon: {
    name: '✨',
    colors: ['hsl(280,80%,60%)', 'hsl(320,75%,55%)', 'hsl(200,90%,55%)', 'hsl(160,80%,45%)', 'hsl(50,85%,50%)', 'hsl(340,70%,55%)', 'hsl(180,75%,48%)', 'hsl(260,70%,58%)'],
    bg: '#1a1a2e',
  },
  classic: {
    name: '📚',
    colors: ['hsl(220,70%,50%)', 'hsl(350,65%,55%)', 'hsl(160,60%,40%)', 'hsl(280,55%,55%)', 'hsl(30,75%,50%)', 'hsl(190,65%,45%)', 'hsl(120,50%,40%)', 'hsl(15,70%,50%)'],
    bg: '#ffffff',
  },
  candy: {
    name: '🍬',
    colors: ['hsl(330,70%,60%)', 'hsl(280,60%,65%)', 'hsl(200,70%,60%)', 'hsl(160,60%,55%)', 'hsl(40,75%,55%)', 'hsl(350,65%,58%)', 'hsl(180,55%,55%)', 'hsl(300,55%,62%)'],
    bg: '#fff5fa',
  },
  monochrome: {
    name: '🖤',
    colors: ['hsl(0,0%,15%)', 'hsl(0,0%,30%)', 'hsl(0,0%,45%)', 'hsl(0,0%,20%)', 'hsl(0,0%,35%)', 'hsl(0,0%,50%)', 'hsl(0,0%,25%)', 'hsl(0,0%,40%)'],
    bg: '#ffffff',
  },
};

/**
 * Layout words in a spiral pattern.
 * Returns positioned words with x, y (center-based), fontSize, rotation.
 */
export function layoutWordCloud(
  items: WordItem[],
  width: number,
  height: number,
  minFont = 14,
  maxFont = 72,
): PositionedWord[] {
  if (items.length === 0) return [];

  const maxCount = items[0].count;
  const minCount = items[items.length - 1].count;
  const range = Math.max(maxCount - minCount, 1);

  const positioned: PositionedWord[] = [];
  const occupied: { x: number; y: number; w: number; h: number }[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const t = (item.count - minCount) / range;
    const fontSize = Math.round(minFont + t * (maxFont - minFont));
    const rotation = Math.random() < 0.3 ? (Math.random() < 0.5 ? -90 : 90) : 0;
    const color = CLOUD_COLORS[i % CLOUD_COLORS.length];

    // Estimate bounding box
    const charW = fontSize * 0.65;
    const wordW = rotation !== 0 ? fontSize * 1.2 : item.word.length * charW;
    const wordH = rotation !== 0 ? item.word.length * charW : fontSize * 1.2;

    // Spiral placement
    let placed = false;
    for (let step = 0; step < 500; step++) {
      const angle = step * 0.15;
      const radius = step * 1.2;
      const cx = width / 2 + radius * Math.cos(angle);
      const cy = height / 2 + radius * Math.sin(angle);

      const rect = {
        x: cx - wordW / 2,
        y: cy - wordH / 2,
        w: wordW,
        h: wordH,
      };

      // Check bounds
      if (rect.x < 0 || rect.y < 0 || rect.x + rect.w > width || rect.y + rect.h > height) continue;

      // Check overlap
      const overlaps = occupied.some(o =>
        !(rect.x + rect.w < o.x || rect.x > o.x + o.w || rect.y + rect.h < o.y || rect.y > o.y + o.h)
      );

      if (!overlaps) {
        occupied.push(rect);
        positioned.push({
          ...item,
          x: cx,
          y: cy,
          fontSize,
          rotation,
          color,
        });
        placed = true;
        break;
      }
    }

    if (!placed && i < 30) {
      // Force-place important words at edge
      positioned.push({
        ...item,
        x: Math.random() * width * 0.8 + width * 0.1,
        y: Math.random() * height * 0.8 + height * 0.1,
        fontSize: Math.max(minFont, fontSize * 0.7),
        rotation: 0,
        color,
      });
    }
  }

  return positioned;
}
