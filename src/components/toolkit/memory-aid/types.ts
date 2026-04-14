export interface CardItem {
  id: string;
  word: string;
  definition: string;
  example?: string;
  wordImage?: string;       // base64 data URL for front/question image
  definitionImage?: string;  // base64 data URL for back/answer image
}

export const DEFAULT_CARDS: CardItem[] = [
  { id: '1', word: 'Serendipity', definition: '意外发现珍奇事物的本领', example: 'Finding a $20 bill on the street.' },
  { id: '2', word: 'Ephemeral', definition: '短暂的，瞬息的', example: 'The mayfly is an ephemeral creature.' },
  { id: '3', word: 'Luminous', definition: '发光的，明亮的', example: 'The watch has a luminous dial.' },
  { id: '4', word: 'Eloquent', definition: '雄辩的，有说服力的', example: 'An eloquent speaker moved the audience.' },
  { id: '5', word: 'Resilience', definition: '韧性，恢复力', example: 'Resilience helps people recover from trauma.' },
  { id: '6', word: 'Ubiquitous', definition: '普遍存在的，无所不在的', example: 'Smartphones are now ubiquitous.' },
];

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Convert a File to a base64 data URL */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
