import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';

export default function CheckInPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'expired'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [sessionValid, setSessionValid] = useState<boolean | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    // Check if session is active
    supabase
      .from('checkin_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setSessionValid(false);
        } else if ((data as any).status !== 'active') {
          setSessionValid(false);
          setStatus('expired');
        } else {
          setSessionValid(true);
        }
      });
  }, [sessionId]);

  const handleCheckin = async () => {
    const trimmed = name.trim();
    if (!trimmed || !sessionId) return;

    setStatus('loading');

    // Fetch student names from session's creator context
    // We check by inserting — the teacher side does matching via realtime
    // First check if name is in any local student list — but student side doesn't have access
    // So we just insert and let the teacher side handle matching

    // Check if already checked in
    const { data: existing } = await supabase
      .from('checkin_records')
      .select('id')
      .eq('session_id', sessionId)
      .eq('student_name', trimmed)
      .maybeSingle();

    if (existing) {
      setStatus('success');
      return;
    }

    // We need to check if the session has a student list — but names are local
    // So we insert with status 'pending' and let teacher side update
    // Actually, teacher side matches via realtime — we insert with 'matched' or 'unknown'
    // But student side doesn't know the list. Let's just insert with 'pending'
    // and let the teacher's realtime handler decide.
    // Simpler: insert as 'matched' — teacher side checks name match on receipt.
    
    const { error } = await supabase
      .from('checkin_records')
      .insert({
        session_id: sessionId,
        student_name: trimmed,
        status: 'pending',
      });

    if (error) {
      setStatus('error');
      setErrorMsg('签到失败，请重试');
      return;
    }

    setStatus('success');
  };

  if (sessionValid === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  if (!sessionValid || status === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <Clock className="w-12 h-12 text-muted-foreground mx-auto" />
          <h1 className="text-xl font-bold text-foreground">签到已结束</h1>
          <p className="text-sm text-muted-foreground">此签到会话已过期或不存在</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 text-primary mx-auto" />
          <h1 className="text-xl font-bold text-foreground">签到成功！</h1>
          <p className="text-sm text-muted-foreground">{name.trim()} 已完成签到</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="text-5xl">📋</div>
          <h1 className="text-xl font-bold text-foreground">课堂签到</h1>
          <p className="text-sm text-muted-foreground">请输入您的姓名完成签到</p>
        </div>

        <div className="space-y-3">
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCheckin()}
            placeholder="请输入姓名"
            className="h-12 text-center text-lg"
            autoFocus
          />
          <Button
            onClick={handleCheckin}
            disabled={!name.trim() || status === 'loading'}
            className="w-full h-12 text-base"
          >
            {status === 'loading' ? '签到中...' : '签到'}
          </Button>

          {status === 'error' && (
            <div className="flex items-center justify-center gap-2 text-destructive text-sm">
              <XCircle className="w-4 h-4" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
