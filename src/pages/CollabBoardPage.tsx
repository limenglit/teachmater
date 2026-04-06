import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import CollaborativeCanvas from '@/components/board/CollaborativeCanvas';
import type { Board } from '@/components/BoardPanel';

function getCreatorToken(boardId: string): string | null {
  try {
    const raw = localStorage.getItem('board_creator_tokens');
    if (!raw) return null;
    const tokens = JSON.parse(raw) as Record<string, string>;
    return tokens[boardId] || null;
  } catch {
    return null;
  }
}

export default function CollabBoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [nickname, setNickname] = useState('');
  const [joined, setJoined] = useState(false);
  const [nameSearch, setNameSearch] = useState('');

  useEffect(() => {
    if (!boardId) return;
    let mounted = true;

    const loadBoard = async () => {
      const { data } = await supabase.from('boards').select('*').eq('id', boardId).single();
      if (mounted && data) setBoard(data as any);
      if (mounted) setLoading(false);
    };

    void loadBoard();

    const channel = supabase
      .channel(`collab-board-meta-${boardId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'boards',
        filter: `id=eq.${boardId}`,
      }, (payload) => {
        setBoard(payload.new as unknown as Board);
      })
      .subscribe();

    // Restore saved nickname
    const saved = localStorage.getItem(`collab-nick-${boardId}`);
    if (saved) { setNickname(saved); setJoined(true); }

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [boardId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">加载中...</div>;
  if (!board) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">白板不存在</div>;

  if (!joined) {
    const studentNames: string[] = (board.student_names || []) as string[];
    const filtered = nameSearch
      ? studentNames.filter(n => n.includes(nameSearch))
      : studentNames;

    const handleJoin = (name?: string) => {
      const n = name || nickname.trim();
      if (!n) return;
      setNickname(n);
      localStorage.setItem(`collab-nick-${boardId}`, n);
      setJoined(true);
    };

    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-4">
          <div className="text-center">
            <h1 className="text-xl font-bold text-foreground mb-1">{board.title}</h1>
            <p className="text-sm text-muted-foreground">🎨 在线协同白板</p>
          </div>

          {studentNames.length > 0 && (
            <div className="space-y-2">
              <Input
                value={nameSearch}
                onChange={e => setNameSearch(e.target.value)}
                placeholder="搜索姓名..."
                className="h-9"
              />
              <div className="max-h-48 overflow-y-auto space-y-1">
                {filtered.map(name => (
                  <button
                    key={name}
                    onClick={() => handleJoin(name)}
                    className="w-full text-left px-3 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors"
                  >
                    {name}
                  </button>
                ))}
              </div>
              <div className="text-center text-xs text-muted-foreground">或手动输入</div>
            </div>
          )}

          <div className="flex gap-2">
            <Input
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              placeholder="输入昵称..."
              className="h-10"
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
            />
            <Button onClick={() => handleJoin()} className="h-10 shrink-0" disabled={!nickname.trim()}>
              加入白板
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const creatorToken = boardId ? getCreatorToken(boardId) : null;
  const isCreator = !!creatorToken;

  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="px-3 py-2 border-b border-border bg-card flex items-center gap-2">
        <h1 className="text-sm font-semibold text-foreground truncate">{board.title}</h1>
        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">🎨 协同</span>
        <span className="text-xs text-muted-foreground ml-auto">{nickname}</span>
      </div>
      <div className="flex-1 overflow-hidden">
        <CollaborativeCanvas
          boardId={board.id}
          nickname={nickname}
          isCreator={isCreator}
          isLocked={board.is_locked}
          creatorToken={creatorToken}
        />
      </div>
    </div>
  );
}
