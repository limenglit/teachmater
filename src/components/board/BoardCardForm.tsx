import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { BoardCard } from '@/components/BoardPanel';

const CARD_COLORS = ['#ffffff', '#fef3c7', '#dbeafe', '#dcfce7', '#fce7f3', '#f3e8ff', '#fed7aa'];

interface Props {
  onSubmit: (card: Partial<BoardCard>) => void;
  columns?: string[];
  viewMode?: string;
  defaultNickname?: string;
}

export default function BoardCardForm({ onSubmit, columns, viewMode, defaultNickname }: Props) {
  const { t } = useLanguage();
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [color, setColor] = useState('#ffffff');
  const [nickname, setNickname] = useState(defaultNickname || '');
  const [columnId, setColumnId] = useState(columns?.[0] || '');

  const handleSubmit = () => {
    if (!content.trim()) return;
    onSubmit({
      content: content.trim(),
      url: url.trim(),
      color,
      author_nickname: nickname.trim() || t('board.anonymous'),
      card_type: url.trim() ? 'url' : 'text',
      column_id: columnId,
    });
    setContent('');
    setUrl('');
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
        <Button size="sm" className="h-8" onClick={handleSubmit} disabled={!content.trim()}>
          {t('board.submit')}
        </Button>
      </div>
    </div>
  );
}
