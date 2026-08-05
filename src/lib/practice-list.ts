export interface PracticeItem {
  id: string;
  question: string;
  type: 'single' | 'multi' | 'tf' | 'short';
  options: string[];
  answer: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  knowledgePoint: string;
  source?: string;
  addedAt: number;
}

const KEY = 'quiz_practice_list_v1';

/** 去掉 AI 可能带上的 "A." / "B、" 之类字母序号前缀，避免选项显示为 "A. A. xxx" */
export function stripOptionPrefix(text: string): string {
  return String(text ?? '').replace(/^\s*[A-Za-zＡ-Ｚ]\s*[.、．:：)）]\s*/, '').trim();
}

function makeId(question: string): string {
  let h = 0;
  for (let i = 0; i < question.length; i++) h = (h * 31 + question.charCodeAt(i)) | 0;
  return `p${Math.abs(h)}`;
}

export function getPracticeList(): PracticeItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function save(list: PracticeItem[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent('practice-list-changed'));
}

/** 追加题目，按题干去重；返回新增与跳过数量 */
export function addToPracticeList(
  items: Omit<PracticeItem, 'id' | 'addedAt'>[],
): { added: number; skipped: number; total: number } {
  const list = getPracticeList();
  const seen = new Set(list.map(i => i.id));
  let added = 0;
  let skipped = 0;
  for (const it of items) {
    const id = makeId(it.question.trim());
    if (seen.has(id)) { skipped++; continue; }
    seen.add(id);
    list.push({
      ...it,
      options: (it.options || []).map(stripOptionPrefix).filter(Boolean),
      id,
      addedAt: Date.now(),
    });
    added++;
  }
  save(list);
  return { added, skipped, total: list.length };
}

export function removeFromPracticeList(id: string) {
  save(getPracticeList().filter(i => i.id !== id));
}

export function clearPracticeList() {
  save([]);
}

/** 判定作答是否正确：选择题比较字母集合，其余做宽松文本比较 */
export function isPracticeAnswerCorrect(item: PracticeItem, response: string): boolean {
  const norm = (s: string) => s.replace(/[\s,，、]/g, '').toUpperCase();
  const a = norm(item.answer);
  const r = norm(response);
  if (!r) return false;
  if (item.type === 'single' || item.type === 'multi' || item.type === 'tf') {
    return a.split('').sort().join('') === r.split('').sort().join('');
  }
  return a.length > 0 && (r === a || r.includes(a) || a.includes(r));
}
