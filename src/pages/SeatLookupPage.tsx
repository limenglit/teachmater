import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams } from '@/lib/router-compat';
import { supabase } from '@/integrations/supabase/client';
import { retryRead } from '@/lib/student-route';
import { suggestNames, normalizeLookupName } from '@/lib/team-lookup';
import { findSeatByName, type SeatLookupPayload, type SeatLookupEntry } from '@/lib/seat-lookup';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, MapPin } from 'lucide-react';

const collator = (() => { try { return new Intl.Collator('zh-Hans-CN-u-co-pinyin'); } catch { return null; } })();

export default function SeatLookupPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [payload, setPayload] = useState<SeatLookupPayload | null>(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [searched, setSearched] = useState(false);
  const [mySeat, setMySeat] = useState<SeatLookupEntry | null>(null);
  const [showSuggest, setShowSuggest] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const mineRef = useRef<HTMLDivElement>(null);

  const namePool = useMemo(() => {
    const names = Array.from(new Set((payload?.entries || []).map(e => e.name.trim()).filter(Boolean)));
    return names.sort((a, b) => (collator ? collator.compare(a, b) : a.localeCompare(b)));
  }, [payload]);
  const suggestions = useMemo(() => suggestNames(namePool, name), [namePool, name]);

  useEffect(() => {
    if (!showSuggest) return;
    const onDown = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setShowSuggest(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [showSuggest]);

  useEffect(() => {
    try { const saved = localStorage.getItem('team_lookup_name'); if (saved) setName(saved); } catch { /* private mode */ }
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      const { data, error: err } = await retryRead(() => supabase.rpc('get_teamwork_session_for_student', { p_session_id: sessionId } as any));
      const d = data as any;
      if (err || !d || d.type !== 'seats' || !d.data?.entries) {
        setError(err ? '网络不稳定，请稍后刷新重试' : '未找到该座位表');
        setLoading(false);
        return;
      }
      setPayload(d.data as SeatLookupPayload);
      setTitle(d.title);
      setLoading(false);
    })();
  }, [sessionId]);

  useEffect(() => {
    if (mySeat) mineRef.current?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
  }, [mySeat]);

  const runSearch = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    try { localStorage.setItem('team_lookup_name', trimmed); } catch { /* private mode */ }
    const found = findSeatByName(payload, trimmed);
    setMySeat(found);
    setSearched(true);
    setShowSuggest(false);
    if (found) speakSeat(found.label);
  };
  const pickName = (picked: string) => { setName(picked); runSearch(picked); };
  // Must run inside the tap handler: iOS/WeChat only allow speech from a user gesture.
  const speakSeat = (label: string) => {
    try {
      const synth = window.speechSynthesis;
      if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(`你的座位是，${label}`);
      u.lang = 'zh-CN';
      u.rate = 0.9;
      synth.speak(u);
    } catch { /* speech unsupported */ }
  };

  if (loading) return <div className="min-h-[100dvh] flex items-center justify-center bg-background text-muted-foreground">加载中...</div>;
  if (error || !payload) return <div className="min-h-[100dvh] flex items-center justify-center bg-background"><p className="text-destructive">{error}</p></div>;

  const closed = new Set(payload.closed);
  const colAisles = payload.colAisles || [];
  const rowAisles = payload.rowAisles || [];
  const visCol = (c: number) => c + colAisles.filter(a => c > a).length;
  const visRow = (r: number) => r + rowAisles.filter(a => r > a).length;
  const doorLeft = !payload.doorOnRight;

  return (
    <div className="min-h-[100dvh] bg-background p-4 sm:p-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-xl font-bold text-foreground text-center mb-1">{title || '查询我的座位'}</h1>
        <p className="text-sm text-muted-foreground text-center mb-6">共 {namePool.length} 人，输入姓氏后点选你的名字</p>

        <div ref={boxRef} className="relative mb-6">
          <div className="flex gap-2">
            <Input
              placeholder="输入姓氏，如「李」"
              value={name}
              onChange={e => { setName(e.target.value); setShowSuggest(true); setSearched(false); }}
              onFocus={() => setShowSuggest(true)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (showSuggest && suggestions.length === 1) pickName(suggestions[0]);
                  else runSearch(name);
                } else if (e.key === 'Escape') setShowSuggest(false);
              }}
              autoComplete="off"
              className="flex-1"
              aria-label="姓名"
            />
            <Button onClick={() => runSearch(name)} className="gap-1.5"><Search className="w-4 h-4" /> 查询</Button>
          </div>
          {showSuggest && suggestions.length > 0 && (
            <div role="listbox" aria-label="候选姓名" className="absolute left-0 right-0 top-full mt-1 z-20 max-h-64 overflow-y-auto rounded-lg border border-border bg-popover p-2 shadow-lg">
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map(n => (
                  <button key={n} type="button" role="option" aria-selected={normalizeLookupName(n) === normalizeLookupName(name)}
                    onClick={() => pickName(n)}
                    className="px-3 py-1.5 rounded-full text-sm border border-border bg-muted text-foreground active:bg-primary active:text-primary-foreground hover:border-primary">
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}
          {showSuggest && name.trim() && suggestions.length === 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-lg border border-border bg-popover p-3 text-center text-sm text-muted-foreground shadow-lg">
              名单里没有含「{name.trim()}」的名字
            </div>
          )}
        </div>

        {searched && !mySeat && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center text-sm text-destructive mb-6">
            座位表里没有「{name.trim()}」，请确认姓名或询问老师
          </div>
        )}

        {searched && mySeat && (
          <div className="rounded-xl border-2 border-primary bg-primary/5 p-5 mb-4 text-center">
            <div className="text-sm text-muted-foreground mb-1">{mySeat.name} 的座位</div>
            <div className="flex items-center justify-center gap-2 text-2xl font-bold text-primary">
              <MapPin className="w-6 h-6" /> {mySeat.label}
            </div>
            <button type="button" onClick={() => speakSeat(mySeat.label)}
              className="mt-3 px-4 py-1.5 rounded-full text-sm border border-primary/30 text-primary bg-background active:bg-primary/10">
              🔊 再听一遍
            </button>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>{doorLeft ? '🚪 门' : '🪟 窗'}</span>
            <span className="px-6 py-1 rounded-md bg-primary/10 text-primary border border-primary/20 font-medium">讲台</span>
            <span>{doorLeft ? '🪟 窗' : '🚪 门'}</span>
          </div>
          <div className="overflow-auto max-h-[60dvh]">
            <div className="grid gap-1 w-fit mx-auto"
              style={{ gridTemplateColumns: `repeat(${payload.cols + colAisles.length}, minmax(2.25rem, auto))` }}>
              {payload.cells.flatMap((row, r) => row.map((n, c) => {
                const isMine = !!mySeat && mySeat.r === r && mySeat.c === c;
                const isClosed = closed.has(`${r}-${c}`);
                return (
                  <div key={`${r}-${c}`} ref={isMine ? mineRef : undefined}
                    style={{ gridRow: visRow(r) + 1, gridColumn: visCol(c) + 1 }}
                    className={`h-8 px-1 rounded text-[10px] leading-none flex items-center justify-center whitespace-nowrap border ${
                      isMine ? 'bg-primary text-primary-foreground border-primary font-bold ring-2 ring-primary/40'
                        : isClosed ? 'border-dashed border-border/50 bg-transparent'
                          : n ? 'bg-muted text-muted-foreground border-border' : 'bg-background border-border/60'}`}>
                    {isMine ? '我' : n ? n.slice(0, 3) : ''}
                  </div>
                );
              }))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
