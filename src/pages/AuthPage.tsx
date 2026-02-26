import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { Mail, Lock, User, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast({ title: '登录失败', description: error.message, variant: 'destructive' });
    } else {
      navigate('/');
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
      toast({ title: '注册失败', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '注册成功', description: '请查收验证邮件后登录' });
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
      toast({ title: '发送失败', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '重置邮件已发送', description: '请查收邮件' });
      setMode('login');
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">互动课堂派</h1>
          <p className="text-sm text-muted-foreground">
            {mode === 'login' ? '登录账户' : mode === 'signup' ? '创建账户' : '重置密码'}
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-4 shadow-sm">
          {mode === 'forgot' ? (
            <>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="邮箱地址"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button onClick={handleForgotPassword} disabled={loading} className="w-full">
                {loading ? '发送中...' : '发送重置邮件'}
              </Button>
              <button onClick={() => setMode('login')} className="text-sm text-primary hover:underline w-full text-center">
                返回登录
              </button>
            </>
          ) : (
            <>
              {mode === 'signup' && (
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="昵称（可选）"
                    value={nickname}
                    onChange={e => setNickname(e.target.value)}
                    className="pl-10"
                  />
                </div>
              )}
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="邮箱地址"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="密码"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (mode === 'login' ? handleLogin() : handleSignup())}
                  className="pl-10"
                />
              </div>
              <Button
                onClick={mode === 'login' ? handleLogin : handleSignup}
                disabled={loading}
                className="w-full"
              >
                {loading ? '请稍候...' : mode === 'login' ? '登录' : '注册'}
              </Button>
              <div className="flex items-center justify-between text-sm">
                <button
                  onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                  className="text-primary hover:underline"
                >
                  {mode === 'login' ? '没有账户？注册' : '已有账户？登录'}
                </button>
                {mode === 'login' && (
                  <button onClick={() => setMode('forgot')} className="text-muted-foreground hover:underline">
                    忘记密码
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <div className="text-center">
          <button onClick={() => navigate('/')} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> 以访客身份继续
          </button>
        </div>
      </div>
    </div>
  );
}
