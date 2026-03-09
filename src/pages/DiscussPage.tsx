import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, User } from 'lucide-react';

export default function DiscussPage() {
  const { topicId } = useParams<{ topicId: string }>();
  const { t } = useLanguage();
  const [topic, setTopic] = useState<{ title: string } | null>(null);
  const [nickname, setNickname] = useState('');
  const [nicknameConfirmed, setNicknameConfirmed] = useState(false);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [recentMessages, setRecentMessages] = useState<{ nickname: string; content: string }[]>([]);

  useEffect(() => {
    if (!topicId) return;
    supabase
      .from('discussion_topics' as any)
      .select('title')
      .eq('id', topicId)
      .single()
      .then(({ data, error }) => {
        if (data) setTopic(data as any);
        if (error) setError(t('discuss.topicNotFound'));
      });

    supabase
      .from('barrage_messages' as any)
      .select('content, nickname')
      .eq('topic_id', topicId)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (data) setRecentMessages((data as any[]).map((m: any) => ({ nickname: m.nickname, content: m.content })).reverse());
      });

    const saved = localStorage.getItem(`discuss-nick-${topicId}`);
    if (saved) {
      setNickname(saved);
      setNicknameConfirmed(true);
    }
  }, [topicId]);

  const handleConfirmNickname = () => {
    if (!nickname.trim()) return;
    setNicknameConfirmed(true);
    localStorage.setItem(`discuss-nick-${topicId}`, nickname.trim());
  };

  const handleSend = async () => {
    if (!content.trim() || !topicId) return;
    setSending(true);
    const { error } = await supabase
      .from('barrage_messages' as any)
      .insert({ topic_id: topicId, content: content.trim(), nickname: nickname.trim() } as any);
    setSending(false);
    if (error) {
      setError(t('discuss.sendFailed'));
    } else {
      setRecentMessages(prev => [...prev.slice(-4), { nickname: nickname.trim(), content: content.trim() }]);
      setContent('');
      setSent(true);
      setTimeout(() => setSent(false), 2000);
    }
  };

  if (error && !topic) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center text-muted-foreground">{error}</div>
      </div>
    );
  }

  if (!nicknameConfirmed) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div>
            <div className="text-4xl mb-3">💬</div>
            <h1 className="text-xl font-bold text-foreground">{topic?.title || t('discuss.loading')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t('discuss.enterNickname')}</p>
          </div>
          <div className="space-y-3">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={nickname}
                onChange={e => setNickname(e.target.value.slice(0, 12))}
                placeholder={t('discuss.nicknamePlaceholder')}
                className="pl-9"
                maxLength={12}
                onKeyDown={e => e.key === 'Enter' && handleConfirmNickname()}
              />
            </div>
            <Button onClick={handleConfirmNickname} disabled={!nickname.trim()} className="w-full gap-2">
              {t('discuss.enterDiscussion')}
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">{t('discuss.noRegister')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="text-sm text-muted-foreground mb-1">{t('discuss.topic')}</div>
          <h1 className="text-xl font-bold text-foreground">{topic?.title || t('discuss.loading')}</h1>
          <div className="text-xs text-muted-foreground mt-1">
            {t('discuss.nickname')}: <span className="text-foreground font-medium">{nickname}</span>
            <button onClick={() => setNicknameConfirmed(false)} className="ml-2 underline text-primary">{t('discuss.edit')}</button>
          </div>
        </div>

        {recentMessages.length > 0 && (
          <div className="bg-muted/50 rounded-xl p-3 space-y-1.5">
            <div className="text-xs text-muted-foreground mb-1">{t('discuss.recentBarrage')}</div>
            {recentMessages.map((msg, i) => (
              <div key={i} className="text-sm text-foreground bg-card rounded-lg px-3 py-1.5">
                <span className="text-xs text-muted-foreground mr-1.5">{msg.nickname}:</span>
                {msg.content}
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value.slice(0, 50))}
            placeholder={t('discuss.inputBarrage')}
            className="w-full h-24 rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            maxLength={50}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{content.length}/50</span>
            <Button onClick={handleSend} disabled={!content.trim() || sending} className="gap-2 px-6">
              <Send className="w-4 h-4" />
              {sending ? t('discuss.sendingBtn') : t('discuss.send')}
            </Button>
          </div>
        </div>

        {sent && (
          <div className="text-center text-sm text-primary font-medium animate-pulse">{t('discuss.sendSuccess')}</div>
        )}
        {error && topic && (
          <div className="text-center text-sm text-destructive">{error}</div>
        )}
        <div className="text-center text-xs text-muted-foreground pt-4">{t('discuss.dataPrivacy')}</div>
      </div>
    </div>
  );
}
