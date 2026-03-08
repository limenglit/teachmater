import { useState, useEffect, useMemo } from 'react';
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

export default function SeatCheckinPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { t } = useLanguage();
  const [session, setSession] = useState<{
    seat_data: unknown;
    student_names: string[];
    scene_config: Record<string, unknown>;
    scene_type: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [checkedIn, setCheckedIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    supabase.from('seat_checkin_sessions').select('*').eq('id', sessionId).single()
      .then(({ data, error }) => {
        if (error || !data) {
          toast({ title: t('seatCheckin.sessionNotFound'), variant: 'destructive' });
          setLoading(false);
          return;
        }
        setSession({
          seat_data: data.seat_data,
          student_names: data.student_names as unknown as string[],
          scene_config: data.scene_config as unknown as Record<string, unknown>,
          scene_type: (data as Record<string, unknown>).scene_type as string || 'classroom',
        });
        setLoading(false);
      });
  }, [sessionId]);

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
    if (!session.student_names.includes(name.trim())) {
      toast({ title: t('seatCheckin.nameNotFound'), description: t('seatCheckin.checkName'), variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await supabase.from('seat_checkin_records').insert({
        session_id: sessionId,
        student_name: name.trim(),
      });
      setCheckedIn(true);
    } catch {
      toast({ title: t('seatCheckin.failed'), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen text-muted-foreground">{t('seatCheckin.loading')}</div>;
  }

  if (!session) {
    return <div className="flex items-center justify-center min-h-screen text-muted-foreground">{t('seatCheckin.notFound')}</div>;
  }

  if (!checkedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            <MapPin className="w-12 h-12 mx-auto text-primary" />
            <h1 className="text-xl font-bold text-foreground">{t('seatCheckin.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('seatCheckin.desc')}</p>
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
              <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
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
    <div className="min-h-screen bg-background p-4 overflow-auto">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2 text-primary">
            <CheckCircle2 className="w-6 h-6" />
            <span className="text-lg font-bold">{t('seatCheckin.success')}</span>
          </div>
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
