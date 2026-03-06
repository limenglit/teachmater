export type CommandItem = {
  text: string;
  emoji?: string;
  iconUrl?: string;
};

export const DEFAULT_COMMAND_EMOJI = '？';
export const ICON_CANDIDATE_MIN = 3;
export const ICON_CANDIDATE_MAX = 6;

export function toIconUrl(iconName: string): string {
  const [prefix, name] = iconName.split(':');
  if (!prefix || !name) return '';
  return `https://api.iconify.design/${prefix}/${name}.svg`;
}

export function buildCustomCommand(topic: string, iconUrl?: string): CommandItem {
  const trimmed = topic.trim();
  if (iconUrl) return { text: trimmed, iconUrl };
  return { text: trimmed, emoji: DEFAULT_COMMAND_EMOJI };
}

export function shouldFallbackToDefault(candidates: string[]): boolean {
  return candidates.length < ICON_CANDIDATE_MIN;
}

type FetchLike = (input: string) => Promise<{
  ok: boolean;
  json: () => Promise<unknown>;
}>;

export async function searchTopicBadgeCandidates(
  topic: string,
  fetcher: FetchLike,
): Promise<string[]> {
  const terms = [topic, `${topic} education`, `${topic} class`, 'education badge'];
  const collected: string[] = [];

  for (const term of terms) {
    const resp = await fetcher(
      `https://api.iconify.design/search?query=${encodeURIComponent(term)}&limit=10`,
    );
    if (!resp.ok) continue;

    const data = await resp.json();
    const icons = Array.isArray((data as { icons?: unknown[] })?.icons)
      ? ((data as { icons: unknown[] }).icons)
      : [];

    for (const icon of icons) {
      const iconUrl = toIconUrl(String(icon));
      if (!iconUrl) continue;
      if (!collected.includes(iconUrl)) {
        collected.push(iconUrl);
      }
      if (collected.length >= ICON_CANDIDATE_MAX) {
        return collected;
      }
    }
  }

  return collected;
}
