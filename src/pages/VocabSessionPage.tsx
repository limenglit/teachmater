import { useEffect, useMemo, useState } from 'react';
import { BookOpen, QrCode } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';

import VocabPlayer from '@/components/vocab/VocabPlayer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  loadVocabSessionForStudent,
  normalizeStudentName,
  resolveRosterStudentName,
  type VocabStudentSession,
} from '@/lib/vocab-session';

const NAME_KEY = 'vocab-session-student-name';

export default function VocabSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<VocabStudentSession | null>(null);
  const [studentName, setStudentName] = useState(() => normalizeStudentName(localStorage.getItem(NAME_KEY) || ''));
  const [nameQuery, setNameQuery] = useState(() => normalizeStudentName(localStorage.getItem(NAME_KEY) || ''));
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      if (!sessionId) {
        setLoading(false);
        return;
      }

      try {
        const next = await loadVocabSessionForStudent(sessionId);
        if (!cancelled) {
          setSession(next);
        }
      } catch (error: any) {
        if (!cancelled) {
          toast.error(error?.message || '加载词库学习会话失败');
          setSession(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSession();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const hasRoster = !!session && session.studentNames.length > 0;
  const canJoin = useMemo(() => normalizeStudentName(nameQuery).length > 0, [nameQuery]);

  const joinSession = () => {
    if (!session) return;

    const resolvedName = resolveRosterStudentName(nameQuery || studentName, session.studentNames);
    if (!resolvedName) {
      toast.error('未在本次学习名单中找到该姓名，请从名单中选择后再进入');
      return;
    }

    setStudentName(resolvedName);
    setNameQuery(resolvedName);
    localStorage.setItem(NAME_KEY, resolvedName);
    setJoined(true);
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background px-4">
        <p className="text-muted-foreground">正在加载词库学习会话…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background px-4">
        <div className="text-center">
          <QrCode className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-foreground font-medium">未找到该词库学习会话</p>
          <p className="text-sm text-muted-foreground mt-1">请让老师重新生成二维码后再扫码进入。</p>
        </div>
      </div>
    );
  }

  if (session.status !== 'active') {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background px-4">
        <div className="text-center">
          <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-foreground font-medium">本次词库学习已结束</p>
          <p className="text-sm text-muted-foreground mt-1">请等待老师重新开启新的扫码学习会话。</p>
        </div>
      </div>
    );
  }

  if (!joined) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm bg-card rounded-2xl border border-border shadow-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            {session.title}
          </h2>
          <p className="text-sm text-muted-foreground mb-1">{session.cards.length} 个词条</p>
          {session.className && (
            <p className="text-xs text-muted-foreground mb-4">班级：{session.className}</p>
          )}

          <Input
            value={nameQuery}
            onChange={(event) => setNameQuery(event.target.value)}
            placeholder={hasRoster ? '请输入或选择你的姓名' : '请输入你的姓名'}
            className="mb-2"
            list={hasRoster ? 'vocab-session-roster' : undefined}
            onKeyDown={(event) => {
              if (event.key === 'Enter') joinSession();
            }}
          />

          {hasRoster && (
            <>
              <datalist id="vocab-session-roster">
                {session.studentNames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              <p className="text-xs text-muted-foreground mb-4">请从老师关联的班级名单中选择自己的姓名后进入学习。</p>
            </>
          )}

          {!hasRoster && <p className="text-xs text-muted-foreground mb-4">进入后可以在手机上切换消消乐或闪卡模式进行学习。</p>}

          <Button onClick={joinSession} disabled={!canJoin} className="w-full">
            进入词库学习
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="border-b border-border bg-card/80 px-4 py-3 text-center text-sm text-muted-foreground">
        当前学生：<span className="font-medium text-foreground">{studentName}</span>
      </div>
      <VocabPlayer
        set={session.set}
        cardsOverride={session.cards}
        defaultMode={session.defaultMode}
        showCloseButton={false}
        fullScreen={false}
      />
    </div>
  );
}