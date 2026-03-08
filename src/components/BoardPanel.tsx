import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { Plus, Trash2, Settings, Lock, Unlock, Eye, QrCode, Download, Play, ArrowLeft, Columns3, LayoutGrid, Clock, PenBox, Cloud as CloudIcon } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import BoardWallView from './board/BoardWallView';
import BoardKanbanView from './board/BoardKanbanView';
import BoardTimelineView from './board/BoardTimelineView';
import BoardCanvasView from './board/BoardCanvasView';
import BoardPPTMode from './board/BoardPPTMode';
import BoardCardForm from './board/BoardCardForm';
import BoardWordCloud from './board/BoardWordCloud';
import { tFormat } from '@/contexts/LanguageContext';

export interface Board {
  id: string;
  title: string;
  description: string;
  creator_token: string;
  view_mode: string;
  is_locked: boolean;
  moderation_enabled: boolean;
  columns: string[];
  background_color: string;
  banned_words: string;
  created_at: string;
}

export interface BoardCard {
  id: string;
  board_id: string;
  content: string;
  card_type: string;
  media_url: string;
  url: string;
  color: string;
  author_nickname: string;
  is_pinned: boolean;
  is_approved: boolean;
  likes_count: number;
  column_id: string;
  position_x: number;
  position_y: number;
  sort_order: number;
  created_at: string;
}

const BOARD_COLORS = ['#ffffff', '#fef3c7', '#dbeafe', '#dcfce7', '#fce7f3', '#f3e8ff', '#fed7aa'];
const STORAGE_KEY = 'board-creator-tokens';

function getCreatorTokens(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch { return {}; }
}

function saveCreatorToken(boardId: string, token: string) {
  const tokens = getCreatorTokens();
  tokens[boardId] = token;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

function getCreatorToken(boardId: string): string | null {
  return getCreatorTokens()[boardId] || null;
}

// Local board storage for guests
const LOCAL_BOARDS_KEY = 'local-boards';
const LOCAL_CARDS_KEY = 'local-board-cards';

function getLocalBoards(): Board[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_BOARDS_KEY) || '[]'); } catch { return []; }
}
function saveLocalBoards(boards: Board[]) {
  localStorage.setItem(LOCAL_BOARDS_KEY, JSON.stringify(boards));
}
function getLocalCards(boardId: string): BoardCard[] {
  try {
    const all = JSON.parse(localStorage.getItem(LOCAL_CARDS_KEY) || '{}');
    return all[boardId] || [];
  } catch { return []; }
}
function saveLocalCards(boardId: string, cards: BoardCard[]) {
  try {
    const all = JSON.parse(localStorage.getItem(LOCAL_CARDS_KEY) || '{}');
    all[boardId] = cards;
    localStorage.setItem(LOCAL_CARDS_KEY, JSON.stringify(all));
  } catch {}
}

export default function BoardPanel() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const isCloud = !!user;

  const [boards, setBoards] = useState<Board[]>([]);
  const [activeBoard, setActiveBoard] = useState<Board | null>(null);
  const [cards, setCards] = useState<BoardCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPPT, setShowPPT] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  // Load boards
  useEffect(() => {
    if (isCloud) {
      loadCloudBoards();
    } else {
      setBoards(getLocalBoards());
    }
  }, [isCloud]);

  const loadCloudBoards = async () => {
    setLoading(true);
    // For logged-in users, load boards by user_id; also load boards by creator_token for backwards compat
    const tokens = getCreatorTokens();
    const tokenValues = Object.values(tokens);
    
    let allBoards: Board[] = [];
    
    if (user) {
      const { data } = await (supabase.from('boards').select('*') as any).eq('user_id', user.id).order('created_at', { ascending: false });
      if (data) allBoards = data as any[];
    }
    
    // Also load boards matched by creator_token (for migration)
    if (tokenValues.length > 0) {
      const { data } = await supabase.from('boards').select('*').in('creator_token', tokenValues).order('created_at', { ascending: false });
      if (data) {
        for (const b of data as any[]) {
          if (!allBoards.find(ab => ab.id === b.id)) allBoards.push(b);
        }
      }
    }
    
    setBoards(allBoards as Board[]);
    setLoading(false);
  };

  const createBoard = async () => {
    const title = newTitle.trim() || t('board.title');
    if (isCloud) {
      const insertData: any = { title };
      if (user) insertData.user_id = user.id;
      const { data, error } = await supabase.from('boards').insert(insertData).select().single();
      if (error) { toast({ title: error.message, variant: 'destructive' }); return; }
      const board = data as any as Board;
      saveCreatorToken(board.id, board.creator_token);
      setBoards(prev => [board, ...prev]);
      setNewTitle('');
    } else {
      const board: Board = {
        id: crypto.randomUUID(),
        title,
        description: '',
        creator_token: crypto.randomUUID(),
        view_mode: 'wall',
        is_locked: false,
        moderation_enabled: false,
        columns: ['待办', '进行中', '已完成'],
        background_color: '#ffffff',
        banned_words: '',
        created_at: new Date().toISOString(),
      };
      const updated = [board, ...boards];
      saveLocalBoards(updated);
      setBoards(updated);
      setNewTitle('');
    }
  };

  const openBoard = async (board: Board) => {
    setActiveBoard(board);
    if (isCloud) {
      const { data } = await supabase.from('board_cards').select('*').eq('board_id', board.id).order('sort_order', { ascending: true });
      setCards((data as any[] || []) as BoardCard[]);
    } else {
      setCards(getLocalCards(board.id));
    }
  };

  const deleteBoard = async (board: Board) => {
    if (!confirm(t('board.deleteConfirm'))) return;
    if (isCloud) {
      const token = getCreatorToken(board.id);
      if (token) {
        await supabase.rpc('delete_board', { p_board_id: board.id, p_token: token });
      }
    }
    const updated = boards.filter(b => b.id !== board.id);
    if (!isCloud) saveLocalBoards(updated);
    setBoards(updated);
    if (activeBoard?.id === board.id) setActiveBoard(null);
  };

  const updateBoardSetting = async (key: string, value: any) => {
    if (!activeBoard) return;
    const updated = { ...activeBoard, [key]: value };
    setActiveBoard(updated);
    setBoards(prev => prev.map(b => b.id === updated.id ? updated : b));
    if (isCloud) {
      const token = getCreatorToken(activeBoard.id);
      if (token) {
        await supabase.rpc('update_board', {
          p_board_id: activeBoard.id,
          p_token: token,
          [`p_${key}`]: value,
        } as any);
      }
    } else {
      saveLocalBoards(boards.map(b => b.id === updated.id ? updated : b));
    }
  };

  const addCard = async (card: Partial<BoardCard>) => {
    if (!activeBoard) return;
    // Check banned words
    if (activeBoard.banned_words) {
      const words = activeBoard.banned_words.split(',').map(w => w.trim().toLowerCase()).filter(Boolean);
      const content = (card.content || '').toLowerCase();
      if (words.some(w => content.includes(w))) {
        card.is_approved = false;
        toast({ title: t('board.blockedWord') });
      }
    }
    if (activeBoard.moderation_enabled) {
      card.is_approved = false;
    }

    if (isCloud) {
      const { data, error } = await supabase.from('board_cards').insert({
        board_id: activeBoard.id,
        content: card.content || '',
        card_type: card.card_type || 'text',
        media_url: card.media_url || '',
        url: card.url || '',
        color: card.color || '#ffffff',
        author_nickname: card.author_nickname || t('board.anonymous'),
        is_approved: card.is_approved !== false,
        column_id: card.column_id || '',
        position_x: card.position_x || Math.random() * 600,
        position_y: card.position_y || Math.random() * 400,
        sort_order: cards.length,
      }).select().single();
      if (data) setCards(prev => [...prev, data as any as BoardCard]);
    } else {
      const newCard: BoardCard = {
        id: crypto.randomUUID(),
        board_id: activeBoard.id,
        content: card.content || '',
        card_type: card.card_type || 'text',
        media_url: card.media_url || '',
        url: card.url || '',
        color: card.color || '#ffffff',
        author_nickname: card.author_nickname || t('board.anonymous'),
        is_pinned: false,
        is_approved: card.is_approved !== false,
        likes_count: 0,
        column_id: card.column_id || '',
        position_x: card.position_x || Math.random() * 600,
        position_y: card.position_y || Math.random() * 400,
        sort_order: cards.length,
        created_at: new Date().toISOString(),
      };
      const updated = [...cards, newCard];
      setCards(updated);
      saveLocalCards(activeBoard.id, updated);
    }
  };

  const manageCard = async (cardId: string, action: 'approve' | 'reject' | 'pin' | 'unpin' | 'delete') => {
    if (!activeBoard) return;
    if (isCloud) {
      const token = getCreatorToken(activeBoard.id);
      if (token) {
        await supabase.rpc('manage_board_card', {
          p_board_id: activeBoard.id,
          p_token: token,
          p_card_id: cardId,
          p_action: action,
        });
      }
    }
    if (action === 'delete' || action === 'reject') {
      const updated = cards.filter(c => c.id !== cardId);
      setCards(updated);
      if (!isCloud) saveLocalCards(activeBoard.id, updated);
    } else if (action === 'approve') {
      const updated = cards.map(c => c.id === cardId ? { ...c, is_approved: true } : c);
      setCards(updated);
      if (!isCloud) saveLocalCards(activeBoard.id, updated);
    } else if (action === 'pin') {
      const updated = cards.map(c => c.id === cardId ? { ...c, is_pinned: true } : c);
      setCards(updated);
      if (!isCloud) saveLocalCards(activeBoard.id, updated);
    } else if (action === 'unpin') {
      const updated = cards.map(c => c.id === cardId ? { ...c, is_pinned: false } : c);
      setCards(updated);
      if (!isCloud) saveLocalCards(activeBoard.id, updated);
    }
  };

  const likeCard = async (cardId: string) => {
    const likerToken = localStorage.getItem('board-liker-token') || crypto.randomUUID();
    localStorage.setItem('board-liker-token', likerToken);
    if (isCloud) {
      await supabase.from('board_likes').insert({ card_id: cardId, liker_token: likerToken });
    }
    setCards(prev => prev.map(c => c.id === cardId ? { ...c, likes_count: c.likes_count + 1 } : c));
    if (!isCloud && activeBoard) saveLocalCards(activeBoard.id, cards.map(c => c.id === cardId ? { ...c, likes_count: c.likes_count + 1 } : c));
  };

  const exportCSV = () => {
    const approvedCards = cards.filter(c => c.is_approved);
    const header = 'Nickname,Content,Type,URL,Color,Pinned,Likes,Created\n';
    const rows = approvedCards.map(c =>
      `"${c.author_nickname}","${c.content.replace(/"/g, '""')}","${c.card_type}","${c.url}","${c.color}",${c.is_pinned},${c.likes_count},"${c.created_at}"`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `board-${activeBoard?.title || 'export'}.csv`;
    a.click();
  };

  // Realtime subscription for cloud boards
  useEffect(() => {
    if (!isCloud || !activeBoard) return;
    const channel = supabase
      .channel(`board-cards-${activeBoard.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'board_cards',
        filter: `board_id=eq.${activeBoard.id}`,
      }, (payload) => {
        setCards(prev => {
          if (prev.find(c => c.id === (payload.new as any).id)) return prev;
          return [...prev, payload.new as any as BoardCard];
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'board_cards',
        filter: `board_id=eq.${activeBoard.id}`,
      }, (payload) => {
        setCards(prev => prev.map(c => c.id === (payload.new as any).id ? payload.new as any as BoardCard : c));
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'board_cards',
        filter: `board_id=eq.${activeBoard.id}`,
      }, (payload) => {
        setCards(prev => prev.filter(c => c.id !== (payload.old as any).id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isCloud, activeBoard?.id]);

  const pendingCount = cards.filter(c => !c.is_approved).length;
  const approvedCards = cards.filter(c => c.is_approved);
  const sortedCards = [...approvedCards].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // PPT mode
  if (showPPT && activeBoard) {
    return <BoardPPTMode cards={sortedCards} onExit={() => setShowPPT(false)} />;
  }

  // Board detail view
  if (activeBoard) {
    const submitUrl = `${window.location.origin}/board/${activeBoard.id}/submit`;
    const isCreator = !!getCreatorToken(activeBoard.id);

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Board header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => setActiveBoard(null)} className="gap-1">
            <ArrowLeft className="w-4 h-4" /> {t('board.back')}
          </Button>
          <h2 className="font-semibold text-foreground text-sm truncate">{activeBoard.title}</h2>
          {activeBoard.is_locked && (
            <span className="text-xs bg-warning/10 text-warning px-2 py-0.5 rounded-full flex items-center gap-1">
              <Lock className="w-3 h-3" /> {t('board.locked')}
            </span>
          )}
          {pendingCount > 0 && isCreator && (
            <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">
              {tFormat(t('board.pendingCount'), pendingCount)}
            </span>
          )}

          <div className="ml-auto flex items-center gap-1">
            {/* View mode switcher */}
            {(['wall', 'kanban', 'timeline', 'canvas'] as const).map(mode => (
              <Button
                key={mode}
                variant={activeBoard.view_mode === mode ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => updateBoardSetting('view_mode', mode)}
              >
                {mode === 'wall' && <LayoutGrid className="w-3 h-3 mr-1" />}
                {mode === 'kanban' && <Columns3 className="w-3 h-3 mr-1" />}
                {mode === 'timeline' && <Clock className="w-3 h-3 mr-1" />}
                {mode === 'canvas' && <PenBox className="w-3 h-3 mr-1" />}
                {t(`board.view${mode.charAt(0).toUpperCase() + mode.slice(1)}` as any)}
              </Button>
            ))}

            {isCreator && (
              <>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowQR(true)}>
                  <QrCode className="w-3 h-3" /> {t('board.qrcode')}
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowPPT(true)}>
                  <Play className="w-3 h-3" /> {t('board.pptMode')}
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={exportCSV}>
                  <Download className="w-3 h-3" /> {t('board.exportCSV')}
                </Button>
                <Button
                  variant="outline" size="sm" className="h-7 text-xs gap-1"
                  onClick={() => updateBoardSetting('is_locked', !activeBoard.is_locked)}
                >
                  {activeBoard.is_locked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                  {activeBoard.is_locked ? t('board.unlock') : t('board.lock')}
                </Button>
                <Button
                  variant="outline" size="sm" className="h-7 text-xs gap-1"
                  onClick={() => updateBoardSetting('moderation_enabled', !activeBoard.moderation_enabled)}
                >
                  <Eye className="w-3 h-3" />
                  {activeBoard.moderation_enabled ? t('board.moderationOn') : t('board.moderationOff')}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Add card form */}
        {!activeBoard.is_locked && (
          <div className="px-4 py-2 border-b border-border bg-card">
            <BoardCardForm
              onSubmit={addCard}
              columns={activeBoard.columns}
              viewMode={activeBoard.view_mode}
              isCloud={isCloud}
              boardId={activeBoard.id}
            />
          </div>
        )}

        {/* Pending cards (creator only) */}
        {isCreator && pendingCount > 0 && (
          <div className="px-4 py-2 bg-warning/5 border-b border-border">
            <div className="text-xs font-semibold text-warning mb-2">{t('board.pending')} ({pendingCount})</div>
            <div className="flex flex-wrap gap-2">
              {cards.filter(c => !c.is_approved).map(card => (
                <div key={card.id} className="bg-card border border-border rounded-lg p-2 text-xs max-w-[200px]">
                  <p className="text-foreground truncate">{card.content}</p>
                  <p className="text-muted-foreground">{card.author_nickname}</p>
                  <div className="flex gap-1 mt-1">
                    <Button size="sm" className="h-5 text-[10px] px-1.5" onClick={() => manageCard(card.id, 'approve')}>{t('board.approve')}</Button>
                    <Button size="sm" variant="destructive" className="h-5 text-[10px] px-1.5" onClick={() => manageCard(card.id, 'reject')}>{t('board.reject')}</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Board content */}
        <div className="flex-1 overflow-auto p-4">
          {activeBoard.view_mode === 'wall' && (
            <BoardWallView cards={sortedCards} onManage={manageCard} onLike={likeCard} isCreator={isCreator} isCloud={isCloud} />
          )}
          {activeBoard.view_mode === 'kanban' && (
            <BoardKanbanView cards={sortedCards} columns={activeBoard.columns} onManage={manageCard} onLike={likeCard} isCreator={isCreator} isCloud={isCloud} />
          )}
          {activeBoard.view_mode === 'timeline' && (
            <BoardTimelineView cards={sortedCards} onManage={manageCard} onLike={likeCard} isCreator={isCreator} isCloud={isCloud} />
          )}
          {activeBoard.view_mode === 'canvas' && (
            <BoardCanvasView cards={sortedCards} onManage={manageCard} onLike={likeCard} isCreator={isCreator} />
          )}
        </div>

        {/* QR Code Dialog */}
        <Dialog open={showQR} onOpenChange={setShowQR}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{t('board.scanToJoin')}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="bg-background p-4 rounded-xl border border-border">
                <QRCodeSVG value={submitUrl} size={200} level="M" />
              </div>
              <p className="text-xs text-muted-foreground text-center break-all">{submitUrl}</p>
              <Button size="sm" variant="outline" onClick={() => {
                navigator.clipboard.writeText(submitUrl);
                toast({ title: t('board.shareLink') });
              }}>
                {t('board.shareLink')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Board list view
  return (
    <div className="bg-card rounded-2xl border border-border shadow-card p-6">
      <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
        🎨 {t('board.title')}
      </h3>

      {/* Create new board */}
      <div className="flex gap-2 mb-4">
        <Input
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          placeholder={t('board.boardTitle')}
          className="h-9"
          onKeyDown={e => e.key === 'Enter' && createBoard()}
        />
        <Button size="sm" onClick={createBoard} className="h-9 gap-1">
          <Plus className="w-4 h-4" /> {t('board.create')}
        </Button>
      </div>

      {!isCloud && (
        <p className="text-xs text-muted-foreground mb-3">💡 {t('settings.localOnly')}</p>
      )}
      {isCloud && (
        <p className="text-xs text-muted-foreground mb-3">{t('board.cloudSync')}</p>
      )}

      {/* Board list */}
      <div className="space-y-2">
        {boards.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-6">{t('board.noBoards')}</p>
        )}
        {boards.map(board => (
          <div
            key={board.id}
            className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
            onClick={() => openBoard(board)}
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground truncate">{board.title}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(board.created_at).toLocaleDateString()}
                {board.is_locked && <span className="ml-2">🔒</span>}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs opacity-0 group-hover:opacity-100 text-destructive"
              onClick={(e) => { e.stopPropagation(); deleteBoard(board); }}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
