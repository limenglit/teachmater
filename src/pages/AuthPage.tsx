import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { Mail, Lock, User, ArrowLeft, Clock, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDocumentHead } from '@/hooks/useDocumentHead';

/** True when the request never reached the server (blocked / DNS / offline). */
function isNetworkError(err: { message?: string; name?: string; status?: number } | null | undefined): boolean {
  if (!err) return false;
  if (err.name === 'AuthRetryableFetchError') return true;
  return /load failed|failed to fetch|networkerror|network request failed|fetch failed/i.test(err.message || '');
}

export default function AuthPage() {
  useDocumentHead({
    title: '登录 / 注册 — 教创搭子 TeacherMate',
    description: '登录或注册教创搭子账号，开启随机点名、座位编排、白板协作、AI 测验生成等课堂工具的完整教学体验。',
    canonical: 'https://teachermate.org.cn/auth',
    ogTitle: '登录 / 注册 — 教创搭子 TeacherMate',
    ogDescription: '登录或注册教创搭子账号，使用面向教师的智能课堂工具集。',
    ogUrl: 'https://teachermate.org.cn/auth',
    ogType: 'website',
  });
  const { user, approvalStatus, isAdmin, signOut } = useAuth();
  const { t } = useLanguage();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);
  const [networkBlocked, setNetworkBlocked] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
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
    setNetworkBlocked(false);
    // Network-level failures ("Load failed" in Safari, "Failed to fetch" in
    // Chromium) never reach the server — retry a few times before giving up.
    let result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    for (let attempt = 1; attempt <= 2 && result.error && isNetworkError(result.error); attempt++) {
      await new Promise(r => setTimeout(r, 1000 * attempt));
      result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    }
    const { error } = result;
    setLoading(false);
    if (error) {
      if (isNetworkError(error)) {
        setNetworkBlocked(true);
        return;
      }
      const unconfirmed =
        (error as { code?: string }).code === 'email_not_confirmed' ||
        /email\s+not\s+confirmed/i.test(error.message || '');
      if (unconfirmed) {
        setNeedsEmailConfirm(true);
        return;
      }
      toast({ title: t('auth.loginFailed'), description: error.message, variant: 'destructive' });
    }
  };

  const handleResendConfirmation = async () => {
    if (!email) return;
    setResendLoading(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setResendLoading(false);
    if (error) {
      toast({ title: t('auth.resendConfirmFailed'), description: error.message, variant: 'destructive' });
    } else {
      toast({ title: t('auth.resendConfirmSent') });
      setNeedsEmailConfirm(false);
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
    login: t('auth.loginTitle'),
    signup: t('auth.signupTitle'),
    forgot: t('auth.forgotTitle'),
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
                <Input type="email" placeholder={t('auth.emailPlaceholder')} value={email} onChange={e => { setEmail(e.target.value); setNeedsEmailConfirm(false); }} className="pl-10" />
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
              {mode === 'login' && networkBlocked && (
                <div role="alert" className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 space-y-2">
                  <p className="text-sm font-medium text-foreground">当前浏览器连不上登录服务器</p>
                  <p className="text-xs text-muted-foreground">
                    账号密码还没发送出去就被网络拦下了（不是密码错误）。通常是这个浏览器的网络设置造成的，可依次尝试：
                  </p>
                  <ol className="text-xs text-muted-foreground list-decimal pl-4 space-y-1">
                    <li>关闭 Safari 的广告/内容拦截扩展（设置 → 扩展），或对本网站停用“内容拦截器”。</li>
                    <li>关闭 VPN / 代理，或换一个网络（如手机热点）再试。</li>
                    <li>把电脑 DNS 改为 223.5.5.5 或 119.29.29.29（系统设置 → 网络 → 详细信息 → DNS）。</li>
                    <li>仍不行时，可先用 Edge 或 Chrome 登录。</li>
                  </ol>
                  <Button variant="outline" size="sm" className="w-full" onClick={handleLogin} disabled={loading}>
                    {loading ? t('auth.pleaseWait') : '重新尝试登录'}
                  </Button>
                </div>
              )}
              {mode === 'login' && needsEmailConfirm && (
                <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 space-y-2">
                  <p className="text-sm font-medium text-foreground">{t('auth.emailNotConfirmed')}</p>
                  <p className="text-xs text-muted-foreground">{t('auth.emailNotConfirmedDesc')}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleResendConfirmation}
                    disabled={resendLoading || !email}
                  >
                    {resendLoading ? t('auth.sending') : t('auth.resendConfirm')}
                  </Button>
                </div>
              )}
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
