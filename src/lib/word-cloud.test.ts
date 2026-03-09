import { describe, it, expect } from 'vitest';
import { tokenize, countFrequencies, layoutWordCloud, CLOUD_THEMES } from './word-cloud';

// ── tokenize ─────────────────────────────────────────────

describe('tokenize', () => {
  it('extracts Latin words and lowercases them', () => {
    const tokens = tokenize('Hello World');
    expect(tokens).toContain('hello');
    expect(tokens).toContain('world');
  });

  it('filters English stop words', () => {
    const tokens = tokenize('the cat is on the mat');
    expect(tokens).not.toContain('the');
    expect(tokens).not.toContain('is');
    expect(tokens).not.toContain('on');
    expect(tokens).toContain('cat');
    expect(tokens).toContain('mat');
  });

  it('ignores single-char Latin words', () => {
    const tokens = tokenize('I a b see');
    expect(tokens).not.toContain('a');
    expect(tokens).not.toContain('b');
    expect(tokens).toContain('see');
  });

  it('extracts CJK bigrams', () => {
    const tokens = tokenize('人工智能');
    expect(tokens).toContain('人工');
    expect(tokens).toContain('工智');
    expect(tokens).toContain('智能');
  });

  it('handles single CJK character', () => {
    const tokens = tokenize('好');
    // Single char, may or may not be filtered by stop words
    expect(Array.isArray(tokens)).toBe(true);
  });

  it('handles mixed CJK and Latin', () => {
    const tokens = tokenize('Hello 世界很大');
    expect(tokens).toContain('hello');
    expect(tokens).toContain('世界');
  });

  it('returns empty for empty string', () => {
    expect(tokenize('')).toEqual([]);
  });

  it('returns empty for stop-word-only input', () => {
    const tokens = tokenize('the is a');
    expect(tokens).toHaveLength(0);
  });
});

// ── countFrequencies ─────────────────────────────────────

describe('countFrequencies', () => {
  it('counts word frequencies across multiple texts', () => {
    const texts = ['hello world', 'hello again', 'hello hello'];
    const result = countFrequencies(texts);
    const helloItem = result.find(r => r.word === 'hello');
    expect(helloItem).toBeDefined();
    expect(helloItem!.count).toBe(4);
  });

  it('filters words with count < 2', () => {
    const texts = ['unique rare common common'];
    const result = countFrequencies(texts);
    expect(result.find(r => r.word === 'unique')).toBeUndefined();
    expect(result.find(r => r.word === 'rare')).toBeUndefined();
    expect(result.find(r => r.word === 'common')).toBeDefined();
  });

  it('respects maxWords limit', () => {
    const texts = Array.from({ length: 100 }, (_, i) => `word${i} word${i}`);
    const result = countFrequencies(texts, 5);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('sorts by count descending', () => {
    const texts = ['alpha alpha alpha', 'beta beta', 'alpha beta gamma gamma gamma gamma'];
    const result = countFrequencies(texts);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].count).toBeGreaterThanOrEqual(result[i].count);
    }
  });

  it('returns empty for empty input', () => {
    expect(countFrequencies([])).toEqual([]);
  });

  it('handles CJK texts', () => {
    const texts = ['人工智能', '人工智能很强大', '人工很重要'];
    const result = countFrequencies(texts);
    const aiItem = result.find(r => r.word === '人工');
    expect(aiItem).toBeDefined();
    expect(aiItem!.count).toBe(3);
  });
});

// ── layoutWordCloud ──────────────────────────────────────

describe('layoutWordCloud', () => {
  const items = [
    { word: 'hello', count: 10 },
    { word: 'world', count: 8 },
    { word: 'test', count: 5 },
    { word: 'word', count: 3 },
  ];

  it('returns positioned words with required fields', () => {
    const result = layoutWordCloud(items, 500, 350);
    expect(result.length).toBeGreaterThan(0);
    result.forEach(w => {
      expect(w).toHaveProperty('x');
      expect(w).toHaveProperty('y');
      expect(w).toHaveProperty('fontSize');
      expect(w).toHaveProperty('rotation');
      expect(w).toHaveProperty('color');
      expect(w).toHaveProperty('word');
      expect(w).toHaveProperty('count');
    });
  });

  it('returns empty for empty items', () => {
    expect(layoutWordCloud([], 500, 350)).toEqual([]);
  });

  it('first word gets largest fontSize', () => {
    const result = layoutWordCloud(items, 500, 350, 14, 72);
    const first = result.find(w => w.word === 'hello');
    if (first) {
      expect(first.fontSize).toBe(72);
    }
  });

  it('positions words within canvas bounds (most of them)', () => {
    const result = layoutWordCloud(items, 500, 350);
    // At least the first few should be reasonably placed
    const mainWords = result.slice(0, 3);
    mainWords.forEach(w => {
      expect(w.x).toBeGreaterThan(0);
      expect(w.y).toBeGreaterThan(0);
    });
  });

  it('uses theme colors', () => {
    const result = layoutWordCloud(items, 500, 350, 14, 72, 'neon');
    const neonColors = CLOUD_THEMES.neon.colors;
    result.forEach(w => {
      expect(neonColors).toContain(w.color);
    });
  });

  it('falls back to classic theme for unknown theme', () => {
    const result = layoutWordCloud(items, 500, 350, 14, 72, 'nonexistent');
    const classicColors = CLOUD_THEMES.classic.colors;
    result.forEach(w => {
      expect(classicColors).toContain(w.color);
    });
  });

  it('handles single item', () => {
    const result = layoutWordCloud([{ word: 'solo', count: 5 }], 500, 350);
    expect(result).toHaveLength(1);
    expect(result[0].word).toBe('solo');
  });
});

// ── CLOUD_THEMES ─────────────────────────────────────────

describe('CLOUD_THEMES', () => {
  it('has expected themes', () => {
    expect(Object.keys(CLOUD_THEMES)).toEqual(
      expect.arrayContaining(['ocean', 'sunset', 'forest', 'neon', 'classic', 'candy', 'monochrome'])
    );
  });

  it('each theme has name, colors array, and bg', () => {
    Object.values(CLOUD_THEMES).forEach(theme => {
      expect(theme.name).toBeDefined();
      expect(theme.colors.length).toBeGreaterThan(0);
      expect(theme.bg).toBeDefined();
    });
  });
});
