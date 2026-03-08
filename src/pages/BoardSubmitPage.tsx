import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { CheckCircle2, Lock, Send, User, ImagePlus } from 'lucide-react';
import type { Board } from '@/components/BoardPanel';

const CARD_COLORS = ['#ffffff', '#fef3c7', '#dbeafe', '#dcfce7', '#fce7f3', '#f3e8ff', '#fed7aa'];

export default function BoardSubmitPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const { t } = useLanguage();
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [nickname, setNickname] = useState('');
  const [nicknameConfirmed, setNicknameConfirmed] = useState(false);
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [color, setColor] = useState('#ffffff');
  const [columnId, setColumnId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [mediaUrl, setMediaUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!boardId) return;
    supabase.from('boards').select('*').eq('id', boardId).single()
      .then(({ data }) => {
        if (data) {
          setBoard(data as any);
          const cols = (data as any).columns;
          if (Array.isArray(cols) && cols.length > 0) setColumnId(cols[0]);
        }
        setLoading(false);
      });

    const saved = localStorage.getItem(`board-nick-${boardId}`);
    if (saved) {
      setNickname(saved);
      setNicknameConfirmed(true);
    }
  }, [boardId]);

  const confirmNickname = () => {
    if (!nickname.trim()) return;
    setNicknameConfirmed(true);
    localStorage.setItem(`board-nick-${boardId}`, nickname.trim());
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !boardId) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${boardId}/${crypto.randomUUID()}.${ext}`;
    const { data, error } = await supabase.storage.from('board-media').upload(path, file);
    if (error) { setUploading(false); return; }
    const { data: urlData } = supabase.storage.from('board-media').getPublicUrl(data.path);
    setMediaUrl(urlData.publicUrl);
    setUploading(false);
  };

  const handleSubmit = async () => {
    if ((!content.trim() && !mediaUrl) || !boardId || !board) return;
    setSubmitting(true);

    let isApproved = !board.moderation_enabled;
    if (board.banned_words) {
      const words = board.banned_words.split(',').map(w => w.trim().toLowerCase()).filter(Boolean);
      if (words.some(w => content.toLowerCase().includes(w))) {
        isApproved = false;
      }
    }

    const { error } = await supabase.from('board_cards').insert({
      board_id: boardId,
      content: content.trim(),
      card_type: mediaUrl ? 'image' : url.trim() ? 'url' : 'text',
      url: url.trim(),
      color,
      author_nickname: nickname.trim() || t('board.anonymous'),
      is_approved: isApproved,
      column_id: columnId,
      media_url: mediaUrl,
      position_x: Math.random() * 600,
      position_y: Math.random() * 400,
      sort_order: 0,
    });

    setSubmitting(false);

    if (error) {
      toast({ title: error.message, variant: 'destructive' });
    } else {
      setSubmitted(true);
      setContent('');
      setUrl('');
      setMediaUrl('');
      toast({ title: !isApproved ? t('board.blockedWord') : t('board.submitSuccess') });
      setTimeout(() => setSubmitted(false), 2000);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">{t('common.loading')}</div>;
  }

  if (!board) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">{t('board.noBoards')}</div>;
  }

  if (board.is_locked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <Lock className="w-12 h-12 text-muted-foreground mx-auto" />
          <h1 className="text-xl font-bold text-foreground">{t('board.locked')}</h1>
          <p className="text-sm text-muted-foreground">{t('board.lockedMsg')}</p>
        </div>
      </div>
    );
  }

  if (!nicknameConfirmed) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div>
            <div className="text-4xl mb-3">🎨</div>
            <h1 className="text-xl font-bold text-foreground">{board.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t('board.joinBoard')}</p>
          </div>
          <div className="space-y-3">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={nickname}
                onChange={e => setNickname(e.target.value.slice(0, 12))}
                placeholder={t('board.nicknamePlaceholder')}
                className="pl-9"
                maxLength={12}
                onKeyDown={e => e.key === 'Enter' && confirmNickname()}
                autoFocus
              />
            </div>
            <Button onClick={confirmNickname} disabled={!nickname.trim()} className="w-full gap-2">
              {t('board.joinBoard')} 🚀
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="text-sm text-muted-foreground mb-1">🎨 {board.title}</div>
          <h1 className="text-xl font-bold text-foreground">{t('board.submitPage')}</h1>
          <div className="text-xs text-muted-foreground mt-1">
            {t('board.nickname')}: <span className="text-foreground font-medium">{nickname}</span>
            <button onClick={() => setNicknameConfirmed(false)} className="ml-2 underline text-primary">{t('common.edit')}</button>
          </div>
        </div>

        <div className="space-y-3">
          <Textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={t('board.cardContent')}
            className="min-h-[100px] text-base"
            rows={4}
          />

          {mediaUrl && (
            <div className="relative inline-block">
              <img src={mediaUrl} alt="" className="h-24 rounded-lg object-cover" />
              <button onClick={() => setMediaUrl('')} className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">×</button>
            </div>
          )}

          <div className="flex gap-2">
            <Input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder={t('board.cardUrl')}
              className="flex-1"
            />
            <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-1">
              <ImagePlus className="w-4 h-4" />
              {uploading ? t('board.uploading') : t('board.uploadImage')}
            </Button>
          </div>

          {board.view_mode === 'kanban' && Array.isArray(board.columns) && board.columns.length > 0 && (
            <select
              value={columnId}
              onChange={e => setColumnId(e.target.value)}
              className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
            >
              {(board.columns as string[]).map(col => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{t('board.cardColor')}:</span>
            {CARD_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full border-2 transition-all ${color === c ? 'border-primary scale-110' : 'border-border'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <Button onClick={handleSubmit} disabled={(!content.trim() && !mediaUrl) || submitting} className="w-full h-12 text-base gap-2">
            <Send className="w-4 h-4" />
            {submitting ? t('board.submitting') : t('board.submit')}
          </Button>
        </div>

        {submitted && (
          <div className="flex items-center justify-center gap-2 text-primary font-medium animate-pulse">
            <CheckCircle2 className="w-5 h-5" /> {t('board.submitSuccess')}
          </div>
        )}
      </div>
    </div>
  );
}
