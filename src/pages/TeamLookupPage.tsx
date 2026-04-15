import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
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

  useEffect(() => {
    const saved = localStorage.getItem('team_lookup_name');
    if (saved) setName(saved);
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      const { data, error: err } = await supabase
        .from('teamwork_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();
      if (err || !data) {
        setError('未找到该分组/建队信息');
        setLoading(false);
        return;
      }
      setTeams((data.data as any) as Team[]);
      setTitle(data.title);
      setType(data.type);
      setLoading(false);
    })();
  }, [sessionId]);

  const handleSearch = () => {
    if (!name.trim()) return;
    localStorage.setItem('team_lookup_name', name.trim());
    const trimmed = name.trim();
    const found = teams.find(t => t.members.some(m => m.name === trimmed));
    setMyTeam(found || null);
    setSearched(true);
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
          共 {teams.length} 个{label}，输入姓名查询
        </p>

        <div className="flex gap-2 mb-6">
          <Input
            placeholder="请输入你的姓名"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className="flex-1"
          />
          <Button onClick={handleSearch} className="gap-1.5">
            <Search className="w-4 h-4" /> 查询
          </Button>
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
                      m.name === name.trim()
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
