import { useState, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ImagePlus } from 'lucide-react';
import type { BoardCard } from '@/components/BoardPanel';

const CARD_COLORS = ['#ffffff', '#fef3c7', '#dbeafe', '#dcfce7', '#fce7f3', '#f3e8ff', '#fed7aa'];

interface Props {
  onSubmit: (card: Partial<BoardCard>) => void;
  columns?: string[];
  viewMode?: string;
  defaultNickname?: string;
  isCloud?: boolean;
  boardId?: string;
}

export default function BoardCardForm({ onSubmit, columns, viewMode, defaultNickname, isCloud, boardId }: Props) {
  const { t } = useLanguage();
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [color, setColor] = useState('#ffffff');
  const [nickname, setNickname] = useState(defaultNickname || '');
  const [columnId, setColumnId] = useState(columns?.[0] || '');
  const [uploading, setUploading] = useState(false);
  const [mediaUrl, setMediaUrl] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isCloud || !boardId) return;

    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${boardId}/${crypto.randomUUID()}.${ext}`;

    const { data, error } = await supabase.storage.from('board-media').upload(path, file);
    if (error) {
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('board-media').getPublicUrl(data.path);
    setMediaUrl(urlData.publicUrl);
    setUploading(false);
  };

  const handleSubmit = () => {
    if (!content.trim() && !mediaUrl) return;
    onSubmit({
      content: content.trim(),
      url: url.trim(),
      color,
      author_nickname: nickname.trim() || t('board.anonymous'),
      card_type: mediaUrl ? 'image' : url.trim() ? 'url' : 'text',
      column_id: columnId,
      media_url: mediaUrl,
    });
    setContent('');
    setUrl('');
    setMediaUrl('');
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex-1 min-w-[200px]">
        <Textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder={t('board.cardContent')}
          className="min-h-[60px] text-sm resize-none"
          rows={2}
        />
        {mediaUrl && (
          <div className="mt-1 relative inline-block">
            <img src={mediaUrl} alt="" className="h-16 rounded-lg object-cover" />
            <button onClick={() => setMediaUrl('')} className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center">×</button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={nickname}
          onChange={e => setNickname(e.target.value)}
          placeholder={t('board.nicknamePlaceholder')}
          className="h-8 w-24 text-xs"
        />
        <Input
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder={t('board.cardUrl')}
          className="h-8 w-36 text-xs"
        />
        {isCloud && (
          <>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              <ImagePlus className="w-3 h-3" />
              {uploading ? t('board.uploading') : t('board.uploadImage')}
            </Button>
          </>
        )}
        {viewMode === 'kanban' && columns && columns.length > 0 && (
          <select
            value={columnId}
            onChange={e => setColumnId(e.target.value)}
            className="h-8 text-xs rounded-md border border-border bg-background px-2"
          >
            {columns.map(col => (
              <option key={col} value={col}>{col}</option>
            ))}
          </select>
        )}
        <div className="flex gap-1">
          {CARD_COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-5 h-5 rounded-full border-2 transition-all ${color === c ? 'border-primary scale-110' : 'border-border'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <Button size="sm" className="h-8" onClick={handleSubmit} disabled={!content.trim() && !mediaUrl}>
          {t('board.submit')}
        </Button>
      </div>
    </div>
  );
}
