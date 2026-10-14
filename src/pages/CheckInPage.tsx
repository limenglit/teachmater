import '@/student.css';
import { useState, useEffect, useRef } from 'react';
import { useParams } from '@/lib/scan-params';
import { useLanguage } from '@/contexts/language-core';
import { studentSupabase as supabase } from '@/lib/student-supabase';
import { normalizeSessionId, loadScanSession } from '@/lib/scan-session';
import { Button, Input } from '@/components/student-ui';

// 极简内联图标：不加载图标库，学生手机少下载。
const Ico = ({ d, className }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="10" /><path d={d} />
  </svg>
);
const Clock = (p: { className?: string }) => <Ico d="M12 6v6l4 2" {...p} />;
const CheckCircle2 = (p: { className?: string }) => <Ico d="m9 12 2 2 4-4" {...p} />;
const XCircle = (p: { className?: string }) => <Ico d="m15 9-6 6M9 9l6 6" {...p} />;

export default function CheckInPage() {
  const { sessionId: rawSessionId } = useParams<{ sessionId: string }>();
  const sessionId = normalizeSessionId(rawSessionId) || undefined;
  const [loadFailed, setLoadFailed] = useState(false);
  const [diagText, setDiagText] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'expired'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [sessionValid, setSessionValid] = useState<boolean | null>(null);
  const [studentNames, setStudentNames] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sessionId) { setSessionValid(false); return; }
    setSessionValid(null);
    setLoadFailed(false);
    loadScanSession('get_checkin_session_for_student', sessionId)
      .then((res) => {
        const diagMod = res.diag ? await import('@/lib/scan-diag') : null;
        if (diagMod && res.diag) diagMod.reportScanDiag('checkin', sessionId, res.kind === 'ok', res.diag);
        if (res.kind !== 'ok') {
          setLoadFailed(res.kind === 'network');
          if (res.kind === 'network') setDiagText(diagMod ? diagMod.formatScanDiag(res.diag) : '');
          setSessionValid(false);
          return;
        }
        const data: any = res.data;
        if (data.status !== 'active') {
          setSessionValid(false);
          setStatus('expired');
        } else {
          setSessionValid(true);
          if (Array.isArray(data.student_names)) setStudentNames(data.student_names);
        }
      });
  }, [sessionId, reloadKey]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleNameChange = (val: string) => {
    setName(val);
    if (val.trim() && studentNames.length > 0) {
      const filtered = studentNames.filter(n => n.includes(val.trim()));
      setSuggestions(filtered.slice(0, 8));
      setShowSuggestions(filtered.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (s: string) => {
    setName(s);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleCheckin = async () => {
    const trimmed = name.trim();
    if (!trimmed || !sessionId) return;
    setStatus('loading');
    const { data: existing } = await supabase.rpc('has_checkin_record', {
      p_session_id: sessionId,
      p_student_name: trimmed,
    } as any);
    if (existing === true) {
      setStatus('success');
      return;
    }
    const { error } = await supabase
      .from('checkin_records')
      .insert({ session_id: sessionId, student_name: trimmed, status: 'pending' });
    if (error) {
      setStatus('error');
      setErrorMsg(t('checkinPage.failed'));
      return;
    }
    setStatus('success');
  };

  if (sessionValid === null) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background p-4">
        <div className="text-muted-foreground">{t('checkinPage.loading')}</div>
      </div>
    );
  }

  if (!sessionValid || status === 'expired') {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <Clock className="w-12 h-12 text-muted-foreground mx-auto" />
          <h1 className="text-xl font-bold text-foreground">{t('checkinPage.expired')}</h1>
          <p className="text-sm text-muted-foreground">{loadFailed ? '签到页加载失败' : t('checkinPage.expiredDesc')}</p>
          {loadFailed && diagText ? (
            <p className="max-w-xs mx-auto break-all text-[11px] leading-4 text-muted-foreground/80 select-all">诊断：{diagText}</p>
          ) : null}
          {status !== 'expired' ? (
            <Button variant="outline" onClick={() => setReloadKey((k) => k + 1)}>重新加载</Button>
          ) : null}
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 text-primary mx-auto" />
          <h1 className="text-xl font-bold text-foreground">{t('checkinPage.success')}</h1>
          <p className="text-sm text-muted-foreground">{t('checkinPage.completed').replace('{0}', name.trim())}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background overflow-y-auto px-4 py-[max(1rem,env(safe-area-inset-top))]">
      <div className="w-full max-w-sm space-y-6 mx-auto min-h-[calc(100dvh-max(2rem,env(safe-area-inset-top))-env(safe-area-inset-bottom))] flex flex-col justify-center pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="text-center space-y-2">
          <div className="text-5xl">📋</div>
          <h1 className="text-xl font-bold text-foreground">{t('checkinPage.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('checkinPage.desc')}</p>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <Input
              ref={inputRef}
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
              onKeyDown={e => { if (e.key === 'Enter') { setShowSuggestions(false); handleCheckin(); } }}
              placeholder={t('checkinPage.namePlaceholder')}
              className="h-12 text-center text-lg"
              autoFocus
            />
            {showSuggestions && suggestions.length > 0 && (
              <div ref={suggestionsRef} className="absolute z-50 w-full mt-1 max-h-56 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
                {suggestions.map((s, i) => (
                  <button key={i} className="w-full text-left px-4 py-2.5 text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground transition-colors" onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s); }}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button onClick={handleCheckin} disabled={!name.trim() || status === 'loading'} className="w-full h-12 text-base">
            {status === 'loading' ? t('checkinPage.checking') : t('checkinPage.checkinBtn')}
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
