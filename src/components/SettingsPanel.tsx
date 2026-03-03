import { useState, useEffect } from 'react';
import { useTheme, COLOR_SCHEMES, FONT_OPTIONS, FONT_SIZE_MIN, FONT_SIZE_MAX } from '@/contexts/ThemeContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Settings, Check, Type, ALargeSmall, LogOut, User } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function SettingsPanel() {
  const { config, setScheme, setFont, setFontSize } = useTheme();
  const { settings, setSettings } = useSettings();
  const { user, signOut } = useAuth();
  const [nickname, setNickname] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('nickname').eq('user_id', user.id).single().then(({ data }) => {
      if (data) setNickname((data as any).nickname || '');
    });
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    await supabase.from('profiles').update({ nickname: nickname.trim() }).eq('user_id', user.id);
    setSaving(false);
    toast({ title: '已保存' });
  };

  const handleSignOut = async () => {
    await signOut();
    toast({ title: '已退出登录' });
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
          <Settings className="w-5 h-5" />
        </button>
      </SheetTrigger>
      <SheetContent className="w-80 overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-foreground">个性化设置</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-8">
          {/* User Profile */}
          {user && (
            <section>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <User className="w-4 h-4" /> 个人资料
              </h3>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-muted-foreground">邮箱</label>
                  <p className="text-sm text-foreground truncate">{user.email}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">昵称</label>
                  <div className="flex gap-1.5 mt-1">
                    <Input
                      value={nickname}
                      onChange={e => setNickname(e.target.value)}
                      placeholder="设置昵称"
                      className="h-8 text-sm"
                    />
                    <Button size="sm" onClick={saveProfile} disabled={saving} className="h-8 px-3">
                      {saving ? '...' : '保存'}
                    </Button>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleSignOut} className="w-full mt-2 gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5">
                  <LogOut className="w-3.5 h-3.5" /> 退出登录
                </Button>
              </div>
            </section>
          )}

          {/* Color Schemes */}
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              🎨 主题配色
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {COLOR_SCHEMES.map(scheme => (
                <button
                  key={scheme.id}
                  onClick={() => setScheme(scheme.id)}
                  className={`relative p-3 rounded-xl border-2 transition-all text-left
                    ${config.schemeId === scheme.id
                      ? 'border-primary shadow-soft bg-accent/30'
                      : 'border-border hover:border-primary/30 bg-card'
                    }`}
                >
                  <div className="flex gap-1.5 mb-2">
                    {scheme.preview.map((color, i) => (
                      <div
                        key={i}
                        className="w-5 h-5 rounded-full border border-border/50"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="text-sm font-medium text-foreground">{scheme.name}</div>
                  <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{scheme.description}</div>
                  {config.schemeId === scheme.id && (
                    <div className="absolute top-2 right-2">
                      <Check className="w-4 h-4 text-primary" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Font Family */}
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Type className="w-4 h-4" /> 字体
            </h3>
            <div className="space-y-1.5">
              {FONT_OPTIONS.map(font => (
                <button
                  key={font.id}
                  onClick={() => setFont(font.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all
                    ${config.fontFamily === font.id
                      ? 'border-primary bg-accent/30 shadow-soft'
                      : 'border-border hover:border-primary/30 bg-card'
                    }`}
                >
                  <span className="text-sm text-foreground" style={{ fontFamily: font.value }}>
                    {font.name}
                  </span>
                  {config.fontFamily === font.id && <Check className="w-4 h-4 text-primary" />}
                </button>
              ))}
            </div>
          </section>

          {/* Layout Defaults */}
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              ⚙️ 默认布局
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm">座位间距</label>
                <Input
                  type="number"
                  min={0}
                  max={200}
                  value={settings.defaultSeatGap}
                  onChange={e => setSettings({ defaultSeatGap: Math.max(0, Math.min(200, Number(e.target.value))) })}
                  className="w-20 h-8 text-center"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm">桌子间距</label>
                <Input
                  type="number"
                  min={0}
                  max={200}
                  value={settings.defaultTableGap}
                  onChange={e => setSettings({ defaultTableGap: Math.max(0, Math.min(200, Number(e.target.value))) })}
                  className="w-20 h-8 text-center"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm">行间距</label>
                <Input
                  type="number"
                  min={0}
                  max={400}
                  value={settings.defaultRowGap}
                  onChange={e => setSettings({ defaultRowGap: Math.max(0, Math.min(400, Number(e.target.value))) })}
                  className="w-20 h-8 text-center"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm">允许拖拽</label>
                <input
                  type="checkbox"
                  checked={settings.enableDragging}
                  onChange={e => setSettings({ enableDragging: e.target.checked })}
                  className="accent-primary"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm">显示参考对象</label>
                <input
                  type="checkbox"
                  checked={settings.showReferenceObjects}
                  onChange={e => setSettings({ showReferenceObjects: e.target.checked })}
                  className="accent-primary"
                />
              </div>
            </div>
          </section>

          {/* Font Size */}
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <ALargeSmall className="w-4 h-4" /> 字号
            </h3>
            <div className="px-1">
              <Slider
                value={[config.fontSize]}
                onValueChange={([v]) => setFontSize(v)}
                min={FONT_SIZE_MIN}
                max={FONT_SIZE_MAX}
                step={0.05}
                className="mb-3"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>小</span>
                <span
                  className="font-medium text-foreground tabular-nums"
                  style={{ fontSize: `${config.fontSize * 14}px` }}
                >
                  {Math.round(config.fontSize * 100)}%
                </span>
                <span>大</span>
              </div>
            </div>
          </section>

          {/* Info */}
          <div className="text-xs text-muted-foreground text-center pt-4 border-t border-border">
            {user ? '☁️ 班级库数据已云端同步' : '🔒 数据仅保存于本地，安全无忧'}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
