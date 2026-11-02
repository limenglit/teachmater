import { useState, useEffect, useMemo, useRef } from 'react';
import { buildNamePool, suggestNames, findTeamByName, normalizeLookupName } from '@/lib/team-lookup';
import { useParams } from '@/lib/router-compat';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Crown, Users, Search } from 'lucide-react';

interface TeamMember { id: string; name: string; isCaptain: boolean; isViceCaptain?: boolean }
interface Team { id: string; name: string; members: TeamMember[] }

export default function TeamLookupPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [teams, setTeams] = useState<Team[]>([]);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('teams');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [searched, setSearched] = useState(false);
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [showSuggest, setShowSuggest] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const namePool = useMemo(() => buildNamePool(teams), [teams]);
  const suggestions = useMemo(() => suggestNames(namePool, name), [namePool, name]);

  // Tap anywhere outside the name box closes the candidate list.
  useEffect(() => {
    if (!showSuggest) return;
    const onDown = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setShowSuggest(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [showSuggest]);

  useEffect(() => {
    const saved = localStorage.getItem('team_lookup_name');
    if (saved) setName(saved);
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      const { data, error: err } = await supabase
        .rpc('get_teamwork_session_for_student', { p_session_id: sessionId } as any);
      if (err || !data) {
        setError('未找到该分组/建队信息');
        setLoading(false);
        return;
      }
      const d = data as any;
      setTeams((d.data) as Team[]);
      setTitle(d.title);
      setType(d.type);
      setLoading(false);
    })();
  }, [sessionId]);

  const runSearch = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    try { localStorage.setItem('team_lookup_name', trimmed); } catch { /* private mode */ }
    setMyTeam(findTeamByName(teams, trimmed));
    setSearched(true);
    setShowSuggest(false);
  };
  const handleSearch = () => runSearch(name);
  const pickName = (picked: string) => {
    setName(picked);
    runSearch(picked);
  };

  const label = type === 'teams' ? '队' : '组';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        加载中...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-xl font-bold text-foreground text-center mb-1">
          {title || `查询我的${label}`}
        </h1>
        <p className="text-sm text-muted-foreground text-center mb-6">
          共 {teams.length} 个{label}{namePool.length > 0 ? `、${namePool.length} 人` : ''}，输入姓氏后点选你的名字
        </p>

        <div ref={boxRef} className="relative mb-6">
          <div className="flex gap-2">
            <Input
              placeholder="输入姓氏，如「李」"
              value={name}
              onChange={e => { setName(e.target.value); setShowSuggest(true); setSearched(false); }}
              onFocus={() => setShowSuggest(true)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  // A single candidate left: Enter picks it directly.
                  if (showSuggest && suggestions.length === 1) pickName(suggestions[0]);
                  else handleSearch();
                } else if (e.key === 'Escape') setShowSuggest(false);
              }}
              autoComplete="off"
              className="flex-1"
              aria-label="姓名"
              aria-autocomplete="list"
              aria-expanded={showSuggest && suggestions.length > 0}
            />
            <Button onClick={handleSearch} className="gap-1.5">
              <Search className="w-4 h-4" /> 查询
            </Button>
          </div>

          {showSuggest && suggestions.length > 0 && (
            <div
              role="listbox"
              aria-label="候选姓名"
              className="absolute left-0 right-0 top-full mt-1 z-20 max-h-64 overflow-y-auto rounded-lg border border-border bg-popover p-2 shadow-lg"
            >
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map(n => (
                  <button
                    key={n}
                    type="button"
                    role="option"
                    aria-selected={normalizeLookupName(n) === normalizeLookupName(name)}
                    onClick={() => pickName(n)}
                    className="px-3 py-1.5 rounded-full text-sm border border-border bg-muted text-foreground active:bg-primary active:text-primary-foreground hover:border-primary"
                  >
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

        {searched && !myTeam && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center text-sm text-destructive mb-6">
            未找到「{name.trim()}」，请确认姓名是否正确
          </div>
        )}

        {searched && myTeam && (
          <div className="rounded-xl border-2 border-primary bg-primary/5 p-5 mb-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-primary">{myTeam.name}</h2>
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {myTeam.members.length} 人
              </span>
            </div>

            {myTeam.members.some(m => m.isCaptain) && (
              <div className="flex items-center gap-2 mb-2 text-sm">
                <Crown className="w-4 h-4 text-warning" fill="currentColor" />
                <span className="text-muted-foreground">
                  {type === 'teams' ? '队长' : '组长'}：
                </span>
                <span className="font-medium text-foreground">
                  {myTeam.members.find(m => m.isCaptain)?.name}
                </span>
              </div>
            )}

            {myTeam.members.some(m => m.isViceCaptain) && (
              <div className="flex items-center gap-2 mb-3 text-sm">
                <Crown className="w-4 h-4 text-blue-500" fill="currentColor" />
                <span className="text-muted-foreground">
                  副{type === 'teams' ? '队长' : '组长'}：
                </span>
                <span className="font-medium text-foreground">
                  {myTeam.members.filter(m => m.isViceCaptain).map(m => m.name).join('、')}
                </span>
              </div>
            )}

            <div className="border-t border-border pt-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                <Users className="w-3.5 h-3.5" /> 全{label}成员
              </div>
              <div className="flex flex-wrap gap-1.5">
                {myTeam.members.map(m => (
                  <span
                    key={m.id}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm border ${
                      normalizeLookupName(m.name) === normalizeLookupName(name)
                        ? 'bg-primary text-primary-foreground border-primary font-semibold'
                        : m.isCaptain
                          ? 'bg-warning/10 text-warning border-warning/30'
                          : m.isViceCaptain
                            ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800'
                            : 'bg-muted text-foreground border-border'
                    }`}
                  >
                    {m.isCaptain && <Crown className="w-3 h-3" fill="currentColor" />}
                    {m.isViceCaptain && <Crown className="w-3 h-3 text-blue-500" />}
                    {m.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
