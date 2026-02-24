import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';

export default function DiscussPage() {
  const { topicId } = useParams<{ topicId: string }>();
  const [topic, setTopic] = useState<{ title: string } | null>(null);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [recentMessages, setRecentMessages] = useState<string[]>([]);

  useEffect(() => {
    if (!topicId) return;
    // Fetch topic title
    supabase
      .from('discussion_topics' as any)
      .select('title')
      .eq('id', topicId)
      .single()
      .then(({ data, error }) => {
        if (data) setTopic(data as any);
        if (error) setError('话题不存在或已过期');
      });

    // Fetch recent messages
    supabase
      .from('barrage_messages' as any)
      .select('content')
      .eq('topic_id', topicId)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (data) setRecentMessages((data as any[]).map((m: any) => m.content).reverse());
      });
  }, [topicId]);

  const handleSend = async () => {
    if (!content.trim() || !topicId) return;
    setSending(true);
    const { error } = await supabase
      .from('barrage_messages' as any)
      .insert({ topic_id: topicId, content: content.trim() } as any);
    setSending(false);
    if (error) {
      setError('发送失败，请重试');
    } else {
      setRecentMessages(prev => [...prev.slice(-4), content.trim()]);
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

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Topic title */}
        <div className="text-center">
          <div className="text-sm text-muted-foreground mb-1">💬 讨论话题</div>
          <h1 className="text-xl font-bold text-foreground">{topic?.title || '加载中...'}</h1>
        </div>

        {/* Recent messages preview */}
        {recentMessages.length > 0 && (
          <div className="bg-muted/50 rounded-xl p-3 space-y-1.5">
            <div className="text-xs text-muted-foreground mb-1">最近弹幕</div>
            {recentMessages.map((msg, i) => (
              <div key={i} className="text-sm text-foreground bg-card rounded-lg px-3 py-1.5">{msg}</div>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="space-y-3">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value.slice(0, 50))}
            placeholder="输入你的弹幕（最多50字）..."
            className="w-full h-24 rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            maxLength={50}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{content.length}/50</span>
            <Button
              onClick={handleSend}
              disabled={!content.trim() || sending}
              className="gap-2 px-6"
            >
              <Send className="w-4 h-4" />
              {sending ? '发送中...' : '发射 🚀'}
            </Button>
          </div>
        </div>

        {/* Success feedback */}
        {sent && (
          <div className="text-center text-sm text-primary font-medium animate-pulse">
            ✅ 发送成功！
          </div>
        )}

        {error && topic && (
          <div className="text-center text-sm text-destructive">{error}</div>
        )}

        <div className="text-center text-xs text-muted-foreground pt-4">
          🔒 所有数据仅用于课堂讨论
        </div>
      </div>
    </div>
  );
}
