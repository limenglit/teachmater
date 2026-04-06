import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useStudents } from '@/contexts/StudentContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { Plus, Trash2, Settings, Lock, Unlock, Eye, QrCode, Download, Play, ArrowLeft, LayoutGrid, Clock, PenBox, Cloud as CloudIcon, FileText, Users, Clapperboard, Archive, Loader2, Palette, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import BoardWallView from './board/BoardWallView';
import BoardTimelineView from './board/BoardTimelineView';
import BoardCanvasView from './board/BoardCanvasView';
import BoardStoryboardView from './board/BoardStoryboardView';
import BoardPPTMode from './board/BoardPPTMode';
import BoardCardForm from './board/BoardCardForm';
import BoardWordCloud from './board/BoardWordCloud';
import BoardReport from './board/BoardReport';
import CollaborativeCanvas from './board/CollaborativeCanvas';
import { tFormat } from '@/contexts/LanguageContext';
import { downloadSvgAsPng } from '@/lib/qr-download';
import QRActionPanel from '@/components/qr/QRActionPanel';

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
  student_names: string[];
  is_collaborative?: boolean;
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

const DEFAULT_STORYBOARD = ['开场', '冲突', '转折', '结尾'];

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
  const { students: sidebarStudents } = useStudents();
  const isCloud = true; // All users use cloud for collaboration features

  const [boards, setBoards] = useState<Board[]>([]);
  const [activeBoard, setActiveBoard] = useState<Board | null>(null);
  const [cards, setCards] = useState<BoardCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPPT, setShowPPT] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showWordCloud, setShowWordCloud] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showRoster, setShowRoster] = useState(false);
  const qrPreviewRef = useRef<HTMLDivElement>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newCollaborative, setNewCollaborative] = useState(false);
  const [storyCount, setStoryCount] = useState(4);
  const [storyThemes, setStoryThemes] = useState('');
  const [classesForSelect, setClassesForSelect] = useState<{id: string; name: string; collegeName: string; students: string[]}[]>([]);

  // Load boards
  useEffect(() => {
    if (isCloud) {
      loadCloudBoards();
    } else {
      setBoards(getLocalBoards());
    }
  }, [isCloud]);

  useEffect(() => {
    if (!activeBoard) return;
    setStoryThemes((activeBoard.columns || []).join('\n'));
    setStoryCount(Math.max(2, (activeBoard.columns || []).length || 4));
  }, [activeBoard?.id, activeBoard?.columns]);

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
      const insertData: any = { title, is_collaborative: newCollaborative };
      if (user) insertData.user_id = user.id;
      const { data, error } = await supabase.from('boards').insert(insertData).select().single();
      if (error) { toast({ title: error.message, variant: 'destructive' }); return; }
      const board = data as any as Board;
      saveCreatorToken(board.id, board.creator_token);
      setBoards(prev => [board, ...prev]);
      setNewTitle('');
      setNewCollaborative(false);
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
        student_names: [],
        is_collaborative: false,
      };
      const updated = [board, ...boards];
      saveLocalBoards(updated);
      setBoards(updated);
      setNewTitle('');
    }
  };

  const openBoard = async (board: Board) => {
    // Ensure creator token is saved locally for boards owned by current user
    if (user && (board as any).user_id === user.id && !getCreatorToken(board.id)) {
      saveCreatorToken(board.id, board.creator_token);
    }
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
          p_student_names: updated.student_names ?? [],
        } as any);
      }
    } else {
      saveLocalBoards(boards.map(b => b.id === updated.id ? updated : b));
    }
  };

  const updateBoardSettings = async (patch: Partial<Board>) => {
    if (!activeBoard) return;

    const previousBoard = activeBoard;
    const updated = { ...activeBoard, ...patch };
    setActiveBoard(updated);
    setBoards(prev => prev.map(b => b.id === updated.id ? updated : b));

    if (isCloud) {
      const token = getCreatorToken(activeBoard.id);
      if (!token) return;

      const { error } = await supabase.rpc('update_board', {
        p_board_id: activeBoard.id,
        p_token: token,
        p_title: patch.title,
        p_description: patch.description,
        p_view_mode: patch.view_mode,
        p_is_locked: patch.is_locked,
        p_moderation_enabled: patch.moderation_enabled,
        p_columns: patch.columns,
        p_background_color: patch.background_color,
        p_banned_words: patch.banned_words,
        p_student_names: patch.student_names ?? activeBoard.student_names ?? [],
      } as any);

      if (error) {
        setActiveBoard(previousBoard);
        setBoards(prev => prev.map(b => b.id === previousBoard.id ? previousBoard : b));
        toast({ title: error.message, variant: 'destructive' });
      }
      return;
    }

    saveLocalBoards(boards.map(b => b.id === updated.id ? updated : b));
  };

  const switchViewMode = async (mode: string) => {
    if (!activeBoard) return;
    const patch: Partial<Board> = { view_mode: mode };
    if (mode === 'storyboard' && (!activeBoard.columns || activeBoard.columns.length < 2)) {
      patch.columns = DEFAULT_STORYBOARD;
    }
    await updateBoardSettings(patch);
  };

  const saveStoryboardLayout = async () => {
    if (!activeBoard) return;
    const targetCount = Math.max(2, Math.min(12, storyCount));
    const rawThemes = storyThemes.split('\n').map(s => s.trim()).filter(Boolean);
    const normalized = Array.from({ length: targetCount }, (_, idx) => rawThemes[idx] || `${t('board.storyPanel')} ${idx + 1}`);
    await updateBoardSetting('columns', normalized);
    setShowSettings(false);
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
        position_x: card.position_x ?? Math.random() * 600,
        position_y: card.position_y ?? Math.random() * 400,
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
        position_x: card.position_x ?? Math.random() * 600,
        position_y: card.position_y ?? Math.random() * 400,
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

  const exportCSV = async () => {
    const approvedCards = cards.filter(c => c.is_approved);
    // Fetch comments for all approved cards
    const cardIds = approvedCards.map(c => c.id);
    let commentsMap: Record<string, string[]> = {};
    if (cardIds.length > 0) {
      const { data: comments } = await supabase
        .from('board_comments')
        .select('card_id, content, author_nickname')
        .in('card_id', cardIds)
        .order('created_at', { ascending: true });
      if (comments) {
        for (const cm of comments) {
          if (!commentsMap[cm.card_id]) commentsMap[cm.card_id] = [];
          commentsMap[cm.card_id].push(`${cm.author_nickname}: ${cm.content}`);
        }
      }
    }
    const BOM = '\uFEFF';
    const header = '作者,内容,类型,链接,颜色,置顶,点赞数,评论,创建时间\n';
    const rows = approvedCards.map(c => {
      const cmts = (commentsMap[c.id] || []).join(' | ').replace(/"/g, '""');
      return `"${c.author_nickname}","${c.content.replace(/"/g, '""')}","${c.card_type}","${c.url || c.media_url}","${c.color}",${c.is_pinned},${c.likes_count},"${cmts}","${new Date(c.created_at).toLocaleString()}"`;
    }).join('\n');
    const blob = new Blob([BOM + header + rows], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `board-${activeBoard?.title || 'export'}.csv`;
    a.click();
  };

  const [archiving, setArchiving] = useState(false);

  const archiveZip = async () => {
    const approvedCards = cards.filter(c => c.is_approved);
    const fileCards = approvedCards.filter(c => c.media_url || (c.url && c.card_type !== 'text'));
    if (fileCards.length === 0) {
      toast({ title: t('board.archiveEmpty'), variant: 'destructive' });
      return;
    }
    setArchiving(true);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      // Fetch comments for summary
      const cardIds = approvedCards.map(c => c.id);
      let commentsMap: Record<string, string[]> = {};
      if (cardIds.length > 0) {
        const { data: comments } = await supabase
          .from('board_comments')
          .select('card_id, content, author_nickname')
          .in('card_id', cardIds)
          .order('created_at', { ascending: true });
        if (comments) {
          for (const cm of comments) {
            if (!commentsMap[cm.card_id]) commentsMap[cm.card_id] = [];
            commentsMap[cm.card_id].push(`${cm.author_nickname}: ${cm.content}`);
          }
        }
      }
      // Add CSV summary
      const BOM = '\uFEFF';
      const csvHeader = '作者,内容,类型,链接,点赞数,评论,创建时间\n';
      const csvRows = approvedCards.map(c => {
        const cmts = (commentsMap[c.id] || []).join(' | ').replace(/"/g, '""');
        return `"${c.author_nickname}","${c.content.replace(/"/g, '""')}","${c.card_type}","${c.url || c.media_url}",${c.likes_count},"${cmts}","${new Date(c.created_at).toLocaleString()}"`;
      }).join('\n');
      zip.file('summary.csv', BOM + csvHeader + csvRows);

      // Download and add files
      let idx = 0;
      for (const card of fileCards) {
        const fileUrl = card.media_url || card.url;
        if (!fileUrl) continue;
        try {
          const resp = await fetch(fileUrl);
          if (!resp.ok) continue;
          const blob = await resp.blob();
          const ext = fileUrl.split('.').pop()?.split('?')[0] || 'bin';
          const safeName = (card.author_nickname || 'anon').replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '_');
          zip.file(`files/${safeName}_${++idx}.${ext}`, blob);
        } catch { /* skip failed downloads */ }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(content);
      a.download = `board-${activeBoard?.title || 'archive'}.zip`;
      a.click();
      toast({ title: t('board.archiveDone') });
    } catch (err) {
      toast({ title: String(err), variant: 'destructive' });
    } finally {
      setArchiving(false);
    }
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

  // Load classes for roster selection
  const loadClassesForSelect = async () => {
    if (!user) return;
    const { data: colleges } = await supabase.from('colleges').select('id, name').eq('user_id', user.id);
    const { data: classes } = await supabase.from('classes').select('id, name, college_id').eq('user_id', user.id);
    const { data: classStudents } = await supabase.from('class_students').select('class_id, name').eq('user_id', user.id);
    if (!classes) return;
    const result = classes.map(cls => ({
      id: cls.id,
      name: cls.name,
      collegeName: colleges?.find(c => c.id === cls.college_id)?.name || '',
      students: (classStudents || []).filter(s => s.class_id === cls.id).map(s => s.name),
    }));
    setClassesForSelect(result);
  };

  const handleSelectClass = async (studentNames: string[]) => {
    if (!activeBoard) return;
    await updateBoardSetting('student_names', studentNames);
    setShowRoster(false);
    toast({ title: t('board.classLinked'), description: tFormat(t('board.studentCount'), studentNames.length) });
  };

  const handleClearRoster = async () => {
    if (!activeBoard) return;
    await updateBoardSetting('student_names', []);
    setShowRoster(false);
  };

  const pendingCount = cards.filter(c => !c.is_approved).length;
  const approvedCards = cards.filter(c => c.is_approved);
  const sortedCards = [...approvedCards].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  const currentViewMode = activeBoard?.view_mode === 'columns' || activeBoard?.view_mode === 'kanban' || activeBoard?.view_mode === 'map'
    ? 'wall'
    : activeBoard?.view_mode;

  // Word cloud mode
  if (showWordCloud && activeBoard) {
    return <BoardWordCloud cards={sortedCards} onClose={() => setShowWordCloud(false)} />;
  }

  // Smart report mode
  if (showReport && activeBoard) {
    return <BoardReport cards={sortedCards} boardTitle={activeBoard.title} onClose={() => setShowReport(false)} />;
  }

  // PPT mode
  if (showPPT && activeBoard) {
    return <BoardPPTMode cards={sortedCards} onExit={() => setShowPPT(false)} />;
  }

  // Collaborative board view
  if (activeBoard && activeBoard.is_collaborative) {
    const submitUrl = `${window.location.origin}/board/${activeBoard.id}/collab`;
    const isCreator = !!getCreatorToken(activeBoard.id) || (!!user && (activeBoard as any).user_id === user.id);
    return (
      <div data-testid="board-panel-session" className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => setActiveBoard(null)} className="gap-1">
            <ArrowLeft className="w-4 h-4" /> {t('board.back')}
          </Button>
          <h2 className="font-semibold text-foreground text-sm truncate">{activeBoard.title}</h2>
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
            <Palette className="w-3 h-3" /> 在线协同
          </span>
          {activeBoard.is_locked && (
            <span className="text-xs bg-warning/10 text-warning px-2 py-0.5 rounded-full flex items-center gap-1">
              <Lock className="w-3 h-3" /> {t('board.locked')}
            </span>
          )}
          <div className="ml-auto flex items-center gap-1 flex-wrap justify-end">
            {isCreator && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => window.open(`/board/${activeBoard.id}/collab`, '_blank', 'noopener,noreferrer')}
                >
                  <ExternalLink className="w-3 h-3" /> 独立页
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowQR(true)}>
                  <QrCode className="w-3 h-3" /> {t('board.qrcode')}
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                  onClick={() => { loadClassesForSelect(); setShowRoster(true); }}
                >
                  <Users className="w-3 h-3" />
                  {activeBoard.student_names?.length > 0
                    ? tFormat(t('board.studentCount'), activeBoard.student_names.length)
                    : t('board.selectClass')}
                </Button>
                <Button
                  variant="outline" size="sm" className="h-7 text-xs gap-1"
                  onClick={() => updateBoardSetting('is_locked', !activeBoard.is_locked)}
                >
                  {activeBoard.is_locked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                  {activeBoard.is_locked ? t('board.unlock') : t('board.lock')}
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <CollaborativeCanvas
            boardId={activeBoard.id}
            nickname={user?.email?.split('@')[0] || '教师'}
            isCreator={isCreator}
            isLocked={activeBoard.is_locked}
            creatorToken={getCreatorToken(activeBoard.id)}
          />
        </div>

        {/* QR dialog */}
        <Dialog open={showQR} onOpenChange={setShowQR}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>{t('board.qrcode')}</DialogTitle></DialogHeader>
            <QRActionPanel url={submitUrl} qrContainerRef={qrPreviewRef} />
          </DialogContent>
        </Dialog>

        {/* Roster dialog */}
        <Dialog open={showRoster} onOpenChange={setShowRoster}>
          <DialogContent className="max-w-md max-h-[70vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{t('board.selectClass')}</DialogTitle></DialogHeader>
            <div className="space-y-2">
              {sidebarStudents.length > 0 && (
                <button onClick={() => handleSelectClass(sidebarStudents.map(s => typeof s === 'string' ? s : s.name))} className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">{t('board.useSidebarList')}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{sidebarStudents.length} {t('sidebar.persons')}</span>
                  </div>
                </button>
              )}
              {classesForSelect.map(cls => (
                <button key={cls.id} onClick={() => handleSelectClass(cls.students)} className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted transition-colors" disabled={cls.students.length === 0}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-foreground">{cls.name}</span>
                      {cls.collegeName && <span className="text-xs text-muted-foreground ml-2">{cls.collegeName}</span>}
                    </div>
                    <span className="text-xs text-muted-foreground">{cls.students.length} {t('sidebar.persons')}</span>
                  </div>
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Board detail view
  if (activeBoard) {
    const submitUrl = `${window.location.origin}/board/${activeBoard.id}/submit`;
    const isCreator = !!getCreatorToken(activeBoard.id) || (!!user && (activeBoard as any).user_id === user.id);

    return (
      <div data-testid="board-panel-session" className="flex-1 flex flex-col overflow-hidden">
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

          <div className="ml-auto flex items-center gap-1 flex-wrap justify-end">
            {/* View mode switcher */}
            {(['wall', 'timeline', 'canvas', 'storyboard'] as const).map(mode => (
              <Button
                key={mode}
                variant={currentViewMode === mode ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => switchViewMode(mode)}
              >
                {mode === 'wall' && <LayoutGrid className="w-3 h-3 mr-1" />}
                {mode === 'timeline' && <Clock className="w-3 h-3 mr-1" />}
                {mode === 'canvas' && <PenBox className="w-3 h-3 mr-1" />}
                {mode === 'storyboard' && <Clapperboard className="w-3 h-3 mr-1" />}
                {t(`board.view${mode.charAt(0).toUpperCase() + mode.slice(1)}` as any)}
              </Button>
            ))}

            {isCreator && currentViewMode === 'storyboard' && (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowSettings(true)}>
                <Settings className="w-3 h-3" /> {t('board.layoutSettings')}
              </Button>
            )}

            {isCreator && (
              <>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => { setShowQR(true); }}>
                  <QrCode className="w-3 h-3" /> {t('board.qrcode')}
                </Button>
                <Button
                  variant={activeBoard.student_names?.length > 0 ? 'default' : 'outline'}
                  size="sm" className="h-7 text-xs gap-1"
                  onClick={() => { loadClassesForSelect(); setShowRoster(true); }}
                >
                  <Users className="w-3 h-3" />
                  {activeBoard.student_names?.length > 0
                    ? tFormat(t('board.studentCount'), activeBoard.student_names.length)
                    : t('board.selectClass')}
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowPPT(true)}>
                  <Play className="w-3 h-3" /> {t('board.pptMode')}
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowWordCloud(true)}>
                  <CloudIcon className="w-3 h-3" /> {t('board.wordCloud')}
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowReport(true)}>
                  <FileText className="w-3 h-3" /> {t('board.smartReport')}
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={exportCSV}>
                  <Download className="w-3 h-3" /> {t('board.exportCSV')}
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={archiveZip} disabled={archiving}>
                  {archiving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Archive className="w-3 h-3" />} {archiving ? t('board.archiving') : t('board.archiveZip')}
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
              viewMode={currentViewMode}
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
          {currentViewMode === 'wall' && (
            <BoardWallView cards={sortedCards} onManage={manageCard} onLike={likeCard} isCreator={isCreator} isCloud={isCloud} />
          )}
          {currentViewMode === 'timeline' && (
            <BoardTimelineView cards={sortedCards} onManage={manageCard} onLike={likeCard} isCreator={isCreator} isCloud={isCloud} />
          )}
          {currentViewMode === 'canvas' && (
            <BoardCanvasView cards={sortedCards} onManage={manageCard} onLike={likeCard} isCreator={isCreator} />
          )}
          {currentViewMode === 'storyboard' && (
            <BoardStoryboardView cards={sortedCards} panels={activeBoard.columns} onManage={manageCard} onLike={likeCard} isCreator={isCreator} isCloud={isCloud} />
          )}
        </div>

        <Dialog open={showSettings} onOpenChange={setShowSettings}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('board.layoutSettings')}</DialogTitle>
            </DialogHeader>
            {currentViewMode === 'storyboard' && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{t('board.storyboardHint')}</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-foreground">{t('board.storyboardCount')}</span>
                  <Input
                    type="number"
                    min={2}
                    max={12}
                    value={storyCount}
                    onChange={(e) => setStoryCount(Number(e.target.value) || 2)}
                    className="w-24 h-9"
                  />
                </div>
                <textarea
                  value={storyThemes}
                  onChange={(e) => setStoryThemes(e.target.value)}
                  className="w-full min-h-[180px] rounded-md border border-border bg-background p-3 text-sm"
                  placeholder={t('board.storyboardThemesPlaceholder')}
                />
                <Button onClick={saveStoryboardLayout}>{t('common.confirm')}</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* QR Code Dialog */}
        <Dialog open={showQR} onOpenChange={setShowQR}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{t('board.scanToJoin')}</DialogTitle>
            </DialogHeader>
            <QRActionPanel
              url={submitUrl}
              qrSize={200}
              qrContainerRef={qrPreviewRef}
              actions={(
                <>
                  <Button size="sm" variant="outline" className="h-8 px-2.5 gap-1 text-xs whitespace-nowrap" onClick={() => {
                    navigator.clipboard.writeText(submitUrl);
                    toast({ title: t('board.shareLink') });
                  }}>
                    {t('board.shareLink')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2.5 gap-1 text-xs whitespace-nowrap"
                    onClick={async () => {
                      try {
                        const svg = qrPreviewRef.current?.querySelector('svg');
                        if (!svg) throw new Error('QR not ready');
                        await downloadSvgAsPng(svg as SVGSVGElement, `board-${activeBoard?.id || 'qrcode'}.png`);
                        toast({ title: t('board.downloadPng') });
                      } catch {
                        toast({ title: '下载PNG失败', variant: 'destructive' });
                      }
                    }}
                  >
                    <Download className="w-3.5 h-3.5" /> {t('board.downloadPng')}
                  </Button>
                </>
              )}
            />
          </DialogContent>
        </Dialog>

        {/* Roster Selection Dialog */}
        <Dialog open={showRoster} onOpenChange={setShowRoster}>
          <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('board.selectClass')}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">{t('board.selectClassDesc')}</p>
            <div className="space-y-2 mt-2">
              {/* Use sidebar list option */}
              {sidebarStudents.length > 0 && (
                <button
                  onClick={() => handleSelectClass(sidebarStudents.map(s => s.name))}
                  className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">{t('board.useSidebarList')}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{sidebarStudents.length} {t('sidebar.persons')}</span>
                  </div>
                </button>
              )}

              {/* Class library options */}
              {classesForSelect.map(cls => (
                <button
                  key={cls.id}
                  onClick={() => handleSelectClass(cls.students)}
                  className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted transition-colors"
                  disabled={cls.students.length === 0}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-foreground">{cls.name}</span>
                      {cls.collegeName && <span className="text-xs text-muted-foreground ml-2">{cls.collegeName}</span>}
                    </div>
                    <span className="text-xs text-muted-foreground">{cls.students.length} {t('sidebar.persons')}</span>
                  </div>
                </button>
              ))}

              {classesForSelect.length === 0 && sidebarStudents.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">{t('sidebar.noStudents')}</p>
              )}

              {/* Clear roster */}
              {activeBoard?.student_names?.length > 0 && (
                <button
                  onClick={handleClearRoster}
                  className="w-full text-left p-3 rounded-lg border border-destructive/30 hover:bg-destructive/5 transition-colors"
                >
                  <span className="text-sm text-destructive">{t('board.noClass')}</span>
                </button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Board list view
  return (
    <div data-testid="board-panel" className="flex-1 overflow-auto p-4 sm:p-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="max-w-4xl mx-auto">
        <h3 className="font-semibold text-foreground mb-5 flex items-center gap-2 text-lg">
          🎨 {t('board.title')}
        </h3>

        {/* Create new board */}
        <div className="flex flex-col gap-2 mb-4">
          <div className="flex gap-3">
            <Input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder={t('board.boardTitle')}
              className="h-10"
              onKeyDown={e => e.key === 'Enter' && createBoard()}
            />
            <Button onClick={createBoard} className="h-10 gap-1.5 px-5 shrink-0">
              <Plus className="w-4 h-4" /> {t('board.create')}
            </Button>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={newCollaborative}
              onChange={e => setNewCollaborative(e.target.checked)}
              className="w-4 h-4 rounded border-primary accent-primary"
            />
            <span className="text-sm text-foreground">🎨 在线协同白板</span>
            <span className="text-xs text-muted-foreground">（支持多人实时绘图协作）</span>
          </label>
        </div>

        {!isCloud && (
          <p className="text-xs text-muted-foreground mb-4">💡 {t('settings.localOnly')}</p>
        )}
        {isCloud && (
          <p className="text-xs text-muted-foreground mb-4">{t('board.cloudSync')}</p>
        )}

        {/* Board list - grid layout */}
        {boards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-28 h-28 mb-6 rounded-full bg-primary/5 flex items-center justify-center">
              <svg viewBox="0 0 80 80" className="w-16 h-16 text-primary/40">
                <rect x="10" y="14" width="24" height="30" rx="4" fill="currentColor" opacity="0.3" />
                <rect x="40" y="8" width="24" height="36" rx="4" fill="currentColor" opacity="0.5" />
                <rect x="25" y="28" width="24" height="28" rx="4" fill="currentColor" opacity="0.4" />
                <circle cx="22" cy="24" r="3" fill="currentColor" opacity="0.7" />
                <circle cx="52" cy="18" r="3" fill="currentColor" opacity="0.7" />
                <line x1="16" y1="34" x2="28" y2="34" stroke="currentColor" strokeWidth="2" opacity="0.5" />
                <line x1="46" y1="28" x2="58" y2="28" stroke="currentColor" strokeWidth="2" opacity="0.5" />
                <line x1="46" y1="33" x2="55" y2="33" stroke="currentColor" strokeWidth="2" opacity="0.4" />
              </svg>
            </div>
            <p className="text-base font-medium text-foreground mb-2">{t('board.noBoards')}</p>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs">
              {t('board.emptyHint')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {boards.map(board => (
              <div
                key={board.id}
                className="flex flex-col justify-between p-4 border border-border rounded-xl bg-card hover:bg-muted/50 hover:shadow-md transition-all cursor-pointer group"
                onClick={() => openBoard(board)}
              >
                <div className="min-w-0 mb-3">
                  <div className="text-sm font-medium text-foreground truncate mb-1">{board.title}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                    {new Date(board.created_at).toLocaleDateString()}
                    {board.is_collaborative && <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px]">🎨 协同</span>}
                    {board.is_locked && <span className="ml-1">🔒</span>}
                    {board.moderation_enabled && <span className="ml-1">👁</span>}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground capitalize">{board.is_collaborative ? '协同画布' : board.view_mode}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-destructive"
                    onClick={(e) => { e.stopPropagation(); deleteBoard(board); }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
