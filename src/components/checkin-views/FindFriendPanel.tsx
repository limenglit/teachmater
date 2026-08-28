import { useMemo, useState } from 'react';
import { Search, UserSearch, X, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface Props {
  /** All names currently seated in the scene. */
  names: string[];
  /** The current student's own name — excluded from results. */
  selfName: string;
  /** Resolve a seat description like 「第3排第7号」 for a given name. */
  resolveLabel: (name: string) => string | null;
  /** Currently highlighted friend (null = none). */
  selected: string | null;
  onSelect: (name: string | null) => void;
}

const normalize = (v: string) => v.replace(/\u3000/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * "找朋友" — search a classmate by name, highlight their seat on the map and
 * show the row/seat description. Mobile-first: big tap targets, no dropdown
 * overlay (results render inline so the on-screen keyboard never hides them).
 */
export default function FindFriendPanel({ names, selfName, resolveLabel, selected, onSelect }: Props) {
  const [query, setQuery] = useState('');

  const pool = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const raw of names) {
      const n = normalize(raw);
      if (!n || n === normalize(selfName) || seen.has(n)) continue;
      seen.add(n);
      list.push(n);
    }
    return list.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  }, [names, selfName]);

  const results = useMemo(() => {
    const q = normalize(query).toLowerCase();
    if (!q) return [];
    return pool.filter(n => n.toLowerCase().includes(q)).slice(0, 8);
  }, [pool, query]);

  const selectedLabel = selected ? resolveLabel(selected) : null;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-3.5 pb-2">
        <UserSearch className="w-4 h-4 text-primary shrink-0" />
        <span className="text-sm font-semibold text-foreground">找朋友</span>
        <span className="text-[11px] text-muted-foreground">输入姓名，在座位图上高亮显示</span>
      </div>

      <div className="px-4 pb-3 space-y-2.5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="输入好友姓名"
            className="h-12 pl-9 pr-10 rounded-xl border-2 text-base focus-visible:border-primary"
            enterKeyHint="search"
            autoComplete="off"
            onKeyDown={e => {
              if (e.key === 'Enter' && results.length > 0) {
                onSelect(results[0]);
                setQuery('');
              }
            }}
          />
          {(query || selected) && (
            <button
              type="button"
              aria-label="清除"
              onClick={() => { setQuery(''); onSelect(null); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted active:bg-muted/70"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {query && results.length === 0 && (
          <p className="text-xs text-muted-foreground px-1 py-1">没有找到该姓名，请确认拼写。</p>
        )}

        {results.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {results.map(n => (
              <button
                key={n}
                type="button"
                onClick={() => { onSelect(n); setQuery(''); }}
                className="px-3.5 py-2 rounded-full border border-border bg-muted/40 text-sm text-foreground active:bg-primary/15 hover:border-primary/50 transition-colors"
              >
                {n}
              </button>
            ))}
          </div>
        )}

        {selected && (
          <div className="rounded-xl border border-primary/25 bg-primary/8 px-3 py-2.5 flex items-center gap-2.5">
            <div className="shrink-0 w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-foreground truncate">{selected}</div>
              <div className="text-xs text-primary font-medium">
                {selectedLabel || '该好友暂未安排座位'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="shrink-0 text-xs text-muted-foreground px-2.5 py-1.5 rounded-lg hover:bg-muted active:bg-muted/70"
            >
              取消高亮
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
