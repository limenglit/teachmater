import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { MapPin, CheckCircle2 } from 'lucide-react';
import ClassroomCheckinView from '@/components/checkin-views/ClassroomCheckinView';
import RoundTableCheckinView from '@/components/checkin-views/RoundTableCheckinView';
import ConferenceCheckinView from '@/components/checkin-views/ConferenceCheckinView';
import ConcertCheckinView from '@/components/checkin-views/ConcertCheckinView';
import ComputerLabCheckinView from '@/components/checkin-views/ComputerLabCheckinView';

const SEAT_CHECKIN_NAME_STORAGE_KEY = 'teachmate-seat-checkin-names';

const getStoredSeatCheckinNames = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(SEAT_CHECKIN_NAME_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
};

const getStoredSeatCheckinName = (sessionId: string) => getStoredSeatCheckinNames()[sessionId] || '';

const saveStoredSeatCheckinName = (sessionId: string, studentName: string) => {
  const next = getStoredSeatCheckinNames();
  next[sessionId] = studentName;
  localStorage.setItem(SEAT_CHECKIN_NAME_STORAGE_KEY, JSON.stringify(next));
};

const hasExistingSeatCheckinRecord = async (sessionId: string, studentName: string) => {
  const { data, error } = await supabase
    .from('seat_checkin_records')
    .select('id')
    .eq('session_id', sessionId)
    .eq('student_name', studentName)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
};

export default function SeatCheckinPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { t } = useLanguage();
  const [session, setSession] = useState<{
    seat_data: unknown;
    student_names: string[];
    scene_config: Record<string, unknown>;
    scene_type: string;
    status: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [checkedIn, setCheckedIn] = useState(false);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    supabase.from('seat_checkin_sessions').select('*').eq('id', sessionId).single()
      .then(async ({ data, error }) => {
        if (error || !data) {
          toast({ title: t('seatCheckin.sessionNotFound'), variant: 'destructive' });
          setLoading(false);
          return;
        }
        const nextSession = {
          seat_data: data.seat_data,
          student_names: data.student_names as unknown as string[],
          scene_config: data.scene_config as unknown as Record<string, unknown>,
          scene_type: (data as Record<string, unknown>).scene_type as string || 'classroom',
          status: (data as Record<string, unknown>).status as string || 'active',
        };
        setSession(nextSession);

        const storedName = getStoredSeatCheckinName(sessionId).trim();
        if (storedName && nextSession.student_names.includes(storedName)) {
          setName(storedName);
          try {
            const exists = await hasExistingSeatCheckinRecord(sessionId, storedName);
            if (exists) {
              setCheckedIn(true);
              setAlreadyCheckedIn(true);
            }
          } catch {
            // Ignore restore failures and allow manual sign-in.
          }
        }

        setLoading(false);
      });
  }, [sessionId, t]);

  const handleNameInput = (val: string) => {
    setName(val);
    if (!session || val.length === 0) { setSuggestions([]); return; }
    const filtered = session.student_names.filter(n =>
      n.toLowerCase().includes(val.toLowerCase()) && n !== val
    );
    setSuggestions(filtered.slice(0, 5));
  };

  const handleSubmit = async () => {
    if (!name.trim() || !sessionId || !session) return;
    const trimmedName = name.trim();
    if (!session.student_names.includes(trimmedName)) {
      toast({ title: t('seatCheckin.nameNotFound'), description: t('seatCheckin.checkName'), variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const exists = await hasExistingSeatCheckinRecord(sessionId, trimmedName);
      if (exists) {
        saveStoredSeatCheckinName(sessionId, trimmedName);
        setName(trimmedName);
        setCheckedIn(true);
        setAlreadyCheckedIn(true);
        return;
      }

      if (session.status !== 'active') {
        toast({ title: '签到已结束，无法新增签到', variant: 'destructive' });
        return;
      }

      await supabase.from('seat_checkin_records').insert({
        session_id: sessionId,
        student_name: trimmedName,
      });
      saveStoredSeatCheckinName(sessionId, trimmedName);
      setName(trimmedName);
      setCheckedIn(true);
      setAlreadyCheckedIn(false);
    } catch {
      toast({ title: t('seatCheckin.failed'), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[100dvh] px-4 text-muted-foreground">{t('seatCheckin.loading')}</div>;
  }

  if (!session) {
    return <div className="flex items-center justify-center min-h-[100dvh] px-4 text-muted-foreground">{t('seatCheckin.notFound')}</div>;
  }

  if (!checkedIn) {
    return (
      <div className="min-h-[100dvh] bg-background overflow-y-auto px-4 py-[max(1rem,env(safe-area-inset-top))]">
        <div className="w-full max-w-sm space-y-6 mx-auto min-h-[calc(100dvh-max(2rem,env(safe-area-inset-top))-env(safe-area-inset-bottom))] flex flex-col justify-center pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="text-center space-y-2">
            <MapPin className="w-12 h-12 mx-auto text-primary" />
            <h1 className="text-xl font-bold text-foreground">{t('seatCheckin.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('seatCheckin.desc')}</p>
            {session.status !== 'active' && (
              <p className="text-sm text-destructive">签到已结束，仅已签到同学可查看座位。</p>
            )}
          </div>
          <div className="relative">
            <Input
              value={name}
              onChange={e => handleNameInput(e.target.value)}
              placeholder={t('seatCheckin.namePlaceholder')}
              className="text-center text-lg h-12"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
            {suggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 max-h-56 overflow-y-auto bg-card border border-border rounded-lg shadow-lg">
                {suggestions.map(s => (
                  <button key={s} onClick={() => { setName(s); setSuggestions([]); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button onClick={handleSubmit} disabled={!name.trim() || submitting} className="w-full h-12 text-base">
            {submitting ? t('seatCheckin.checking') : t('seatCheckin.confirm')}
          </Button>
        </div>
      </div>
    );
  }

  const sceneType = session.scene_type;
  const studentName = name.trim();

  return (
    <div className="min-h-[100dvh] bg-background overflow-auto px-4 py-[max(1rem,env(safe-area-inset-top))]">
      <div className="max-w-2xl mx-auto space-y-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2 text-primary">
            <CheckCircle2 className="w-6 h-6" />
            <span className="text-lg font-bold">{t('seatCheckin.success')}</span>
          </div>
          {alreadyCheckedIn && (
            <p className="text-sm text-muted-foreground">已经完成签到，以下为你的座位信息。</p>
          )}
        </div>

        {sceneType === 'classroom' && (
          <ClassroomCheckinView seatData={session.seat_data} sceneConfig={session.scene_config} studentName={studentName} />
        )}
        {(sceneType === 'smartClassroom' || sceneType === 'banquet') && (
          <RoundTableCheckinView seatData={session.seat_data} sceneConfig={session.scene_config} studentName={studentName} sceneType={sceneType} />
        )}
        {sceneType === 'conference' && (
          <ConferenceCheckinView seatData={session.seat_data} sceneConfig={session.scene_config} studentName={studentName} />
        )}
        {sceneType === 'concertHall' && (
          <ConcertCheckinView seatData={session.seat_data} sceneConfig={session.scene_config} studentName={studentName} />
        )}
        {sceneType === 'computerLab' && (
          <ComputerLabCheckinView seatData={session.seat_data} sceneConfig={session.scene_config} studentName={studentName} />
        )}
      </div>
    </div>
  );
}
