import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';

export default function CheckInPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
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
    if (!sessionId) return;
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
          const names = (data as any).student_names;
          if (Array.isArray(names)) {
            setStudentNames(names);
          }
        }
      });
  }, [sessionId]);

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
          <p className="text-sm text-muted-foreground">{t('checkinPage.expiredDesc')}</p>
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
