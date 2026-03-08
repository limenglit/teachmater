import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { Mail, Lock, User, ArrowLeft, Clock, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AuthPage() {
  const { user, approvalStatus, isAdmin, signOut } = useAuth();
  const { t } = useLanguage();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  if (user && approvalStatus === 'pending') {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="text-6xl">⏳</div>
          <h1 className="text-xl font-bold text-foreground">{t('auth.pendingTitle')}</h1>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{t('auth.pendingDesc')}</p>
          <div className="bg-card border border-border rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-center gap-2 text-warning">
              <Clock className="w-5 h-5" />
              <span className="text-sm font-medium">{t('auth.pendingStatus')}</span>
            </div>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" size="sm" onClick={() => navigate('/')}>
              <ArrowLeft className="w-3 h-3 mr-1" /> {t('auth.guestBtn')}
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut} className="text-destructive">
              {t('settings.logout')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (user && approvalStatus === 'rejected') {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="text-6xl">❌</div>
          <h1 className="text-xl font-bold text-foreground">{t('auth.rejectedTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('auth.rejectedDesc')}</p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" size="sm" onClick={() => navigate('/')}>
              <ArrowLeft className="w-3 h-3 mr-1" /> {t('auth.guestBtn')}
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut} className="text-destructive">
              {t('settings.logout')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (user && approvalStatus === 'approved') {
    navigate('/');
    return null;
  }

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast({ title: t('auth.loginFailed'), description: error.message, variant: 'destructive' });
    }
  };

  const handleSignup = async () => {
    if (!email || !password) return;
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nickname },
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);
    if (error) {
      toast({ title: t('auth.signupFailed'), description: error.message, variant: 'destructive' });
    } else {
      toast({ title: t('auth.signupSuccess'), description: t('auth.signupSuccessDesc') });
      setMode('login');
    }
  };

  const handleForgotPassword = async () => {
    if (!email) return;
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast({ title: t('auth.sendFailed'), description: error.message, variant: 'destructive' });
    } else {
      toast({ title: t('auth.resetSent'), description: t('auth.resetSentDesc') });
      setMode('login');
    }
  };

  const modeLabels: Record<string, string> = {
    login: t('auth.login'),
    signup: t('auth.signup'),
    forgot: t('auth.resetPassword'),
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">{t('app.title')}</h1>
          <p className="text-sm text-muted-foreground">{modeLabels[mode]}</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-4 shadow-sm">
          {mode === 'forgot' ? (
            <>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="email" placeholder={t('auth.emailPlaceholder')} value={email} onChange={e => setEmail(e.target.value)} className="pl-10" />
              </div>
              <Button onClick={handleForgotPassword} disabled={loading} className="w-full">
                {loading ? t('auth.sending') : t('auth.sendReset')}
              </Button>
              <button onClick={() => setMode('login')} className="text-sm text-primary hover:underline w-full text-center">{t('auth.backToLogin')}</button>
            </>
          ) : (
            <>
              {mode === 'signup' && (
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder={t('auth.nicknamePlaceholder')} value={nickname} onChange={e => setNickname(e.target.value)} className="pl-10" />
                </div>
              )}
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="email" placeholder={t('auth.emailPlaceholder')} value={email} onChange={e => setEmail(e.target.value)} className="pl-10" />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder={t('auth.passwordPlaceholder')}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (mode === 'login' ? handleLogin() : handleSignup())}
                  className="pl-10"
                />
              </div>
              <Button onClick={mode === 'login' ? handleLogin : handleSignup} disabled={loading} className="w-full">
                {loading ? t('auth.pleaseWait') : mode === 'login' ? t('auth.login') : t('auth.signup')}
              </Button>
              {mode === 'signup' && (
                <p className="text-xs text-muted-foreground text-center">{t('auth.signupNote')}</p>
              )}
              <div className="flex items-center justify-between text-sm">
                <button onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} className="text-primary hover:underline">
                  {mode === 'login' ? t('auth.noAccount') : t('auth.hasAccount')}
                </button>
                {mode === 'login' && (
                  <button onClick={() => setMode('forgot')} className="text-muted-foreground hover:underline">{t('auth.forgotPassword')}</button>
                )}
              </div>
            </>
          )}
        </div>

        <div className="text-center">
          <button onClick={() => navigate('/')} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> {t('auth.guestContinue')}
          </button>
        </div>
      </div>
    </div>
  );
}
