import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { CheckCircle2, Lock, User, Vote } from 'lucide-react';

interface PollOption {
  label: string;
  color: string;
}

interface Poll {
  id: string;
  title: string;
  poll_type: 'single' | 'multiple';
  options: PollOption[];
  status: string;
}

export default function PollVotePage() {
  const { pollId } = useParams<{ pollId: string }>();
  const { t } = useLanguage();
  const [poll, setPoll] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(true);
  const [nickname, setNickname] = useState('');
  const [nicknameConfirmed, setNicknameConfirmed] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!pollId) return;
    supabase.from('polls').select('*').eq('id', pollId).single()
      .then(({ data }) => {
        if (data) setPoll(data as any);
        setLoading(false);
      });

    const saved = localStorage.getItem(`poll-nick-${pollId}`);
    if (saved) {
      setNickname(saved);
      setNicknameConfirmed(true);
    }
  }, [pollId]);

  const confirmNickname = () => {
    if (!nickname.trim()) return;
    setNicknameConfirmed(true);
    localStorage.setItem(`poll-nick-${pollId}`, nickname.trim());
  };

  const toggleOption = (idx: number) => {
    if (!poll) return;
    if (poll.poll_type === 'single') {
      setSelected([idx]);
    } else {
      setSelected(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
    }
  };

  const handleSubmit = async () => {
    if (!pollId || !poll || selected.length === 0) return;

    // Check if already voted
    const voterToken = localStorage.getItem('poll-voter-token') || crypto.randomUUID();
    localStorage.setItem('poll-voter-token', voterToken);

    setSubmitting(true);
    const { error } = await supabase.from('poll_votes').insert({
      poll_id: pollId,
      voter_token: voterToken,
      voter_name: nickname.trim() || t('board.anonymous'),
      selected_options: selected,
    } as any);
    setSubmitting(false);

    if (error) {
      toast({ title: error.message, variant: 'destructive' });
    } else {
      setSubmitted(true);
      toast({ title: t('poll.voteSuccess') });
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">{t('common.loading')}</div>;
  if (!poll) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">{t('poll.notFound')}</div>;

  if (poll.status !== 'active') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <Lock className="w-12 h-12 text-muted-foreground mx-auto" />
          <h1 className="text-xl font-bold text-foreground">{t('poll.pollEnded')}</h1>
          <p className="text-sm text-muted-foreground">{t('poll.pollEndedMsg')}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 text-primary mx-auto" />
          <h1 className="text-xl font-bold text-foreground">{t('poll.voteSuccess')}</h1>
          <p className="text-sm text-muted-foreground">{t('poll.thankYou')}</p>
        </div>
      </div>
    );
  }

  if (!nicknameConfirmed) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div>
            <div className="text-4xl mb-3">📊</div>
            <h1 className="text-xl font-bold text-foreground">{poll.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t('poll.joinPoll')}</p>
          </div>
          <div className="space-y-3">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={nickname}
                onChange={e => setNickname(e.target.value.slice(0, 12))}
                placeholder={t('poll.namePlaceholder')}
                className="pl-9"
                maxLength={12}
                onKeyDown={e => e.key === 'Enter' && confirmNickname()}
                autoFocus
              />
            </div>
            <Button onClick={confirmNickname} disabled={!nickname.trim()} className="w-full gap-2">
              {t('poll.joinPoll')} 🚀
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="text-sm text-muted-foreground mb-1">📊 {poll.title}</div>
          <h1 className="text-xl font-bold text-foreground">{t('poll.castYourVote')}</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {poll.poll_type === 'single' ? t('poll.selectOne') : t('poll.selectMultiple')}
          </p>
          <div className="text-xs text-muted-foreground mt-1">
            {t('board.nickname')}: <span className="text-foreground font-medium">{nickname}</span>
            <button onClick={() => setNicknameConfirmed(false)} className="ml-2 underline text-primary">{t('common.edit')}</button>
          </div>
        </div>

        <div className="space-y-3">
          {(poll.options as PollOption[]).map((opt, idx) => (
            <button
              key={idx}
              onClick={() => toggleOption(idx)}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                selected.includes(idx)
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border hover:border-primary/30 hover:bg-accent/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    selected.includes(idx)
                      ? 'border-primary bg-primary'
                      : 'border-muted-foreground'
                  }`}
                  style={selected.includes(idx) ? { borderColor: opt.color, backgroundColor: opt.color } : {}}
                >
                  {selected.includes(idx) && (
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  )}
                </div>
                <span className="text-foreground font-medium">{opt.label}</span>
              </div>
            </button>
          ))}
        </div>

        <Button onClick={handleSubmit} disabled={selected.length === 0 || submitting} className="w-full h-12 text-base gap-2">
          <Vote className="w-4 h-4" />
          {submitting ? t('poll.submitting') : t('poll.submitVote')}
        </Button>
      </div>
    </div>
  );
}
