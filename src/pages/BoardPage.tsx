import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import BoardWallView from '@/components/board/BoardWallView';
import BoardKanbanView from '@/components/board/BoardKanbanView';
import BoardTimelineView from '@/components/board/BoardTimelineView';
import BoardCanvasView from '@/components/board/BoardCanvasView';
import type { Board, BoardCard } from '@/components/BoardPanel';
import { RealtimeThrottle } from '@/lib/realtime-throttle';

export default function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const { t } = useLanguage();
  const [board, setBoard] = useState<Board | null>(null);
  const [cards, setCards] = useState<BoardCard[]>([]);
  const [loading, setLoading] = useState(true);
  const throttleRef = useRef<RealtimeThrottle | null>(null);

  useEffect(() => {
    if (!boardId) return;
    Promise.all([
      supabase.from('boards').select('*').eq('id', boardId).single(),
      supabase.from('board_cards').select('*').eq('board_id', boardId).eq('is_approved', true).order('sort_order'),
    ]).then(([boardRes, cardsRes]) => {
      if (boardRes.data) setBoard(boardRes.data as any);
      if (cardsRes.data) setCards(cardsRes.data as any);
      setLoading(false);
    });

    // Throttled realtime: batch rapid events into ~2 updates/sec
    const throttle = new RealtimeThrottle((events) => {
      setCards(prev => {
        let next = [...prev];
        for (const payload of events) {
          if (payload.eventType === 'INSERT' && (payload.new as any).is_approved) {
            if (!next.find(c => c.id === (payload.new as any).id)) {
              next.push(payload.new as any);
            }
          } else if (payload.eventType === 'DELETE') {
            next = next.filter(c => c.id !== (payload.old as any).id);
          } else if (payload.eventType === 'UPDATE') {
            next = next.map(c => c.id === (payload.new as any).id ? payload.new as any : c);
          }
        }
        return next;
      });
    }, 500);
    throttleRef.current = throttle;

    const channel = supabase
      .channel(`board-view-${boardId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'board_cards', filter: `board_id=eq.${boardId}` }, (payload) => {
        throttle.push(payload);
      })
      .subscribe();

    return () => {
      throttle.destroy();
      supabase.removeChannel(channel);
    };
  }, [boardId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">{t('common.loading')}</div>;
  if (!board) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">{t('board.noBoards')}</div>;

  const sorted = [...cards].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const noop = () => {};

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-xl font-bold text-foreground mb-4">{board.title}</h1>
        {board.description && <p className="text-sm text-muted-foreground mb-6">{board.description}</p>}

        {board.view_mode === 'wall' && <BoardWallView cards={sorted} onManage={noop} onLike={noop} isCreator={false} />}
        {board.view_mode === 'kanban' && <BoardKanbanView cards={sorted} columns={board.columns as any || []} onManage={noop} onLike={noop} isCreator={false} />}
        {board.view_mode === 'timeline' && <BoardTimelineView cards={sorted} onManage={noop} onLike={noop} isCreator={false} />}
        {board.view_mode === 'canvas' && <BoardCanvasView cards={sorted} onManage={noop} onLike={noop} isCreator={false} />}
      </div>
    </div>
  );
}
