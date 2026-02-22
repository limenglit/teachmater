import { useTheme, COLOR_SCHEMES, FONT_OPTIONS, FONT_SIZES } from '@/contexts/ThemeContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Settings, Check, Type, ALargeSmall } from 'lucide-react';

export default function SettingsPanel() {
  const { config, setScheme, setFont, setFontSize } = useTheme();

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
                  {/* Color preview dots */}
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

          {/* Font Size */}
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <ALargeSmall className="w-4 h-4" /> 字号
            </h3>
            <div className="flex gap-2">
              {FONT_SIZES.map(size => (
                <button
                  key={size.id}
                  onClick={() => setFontSize(size.id)}
                  className={`flex-1 py-2.5 rounded-lg border text-center transition-all
                    ${config.fontSize === size.id
                      ? 'border-primary bg-accent/30 shadow-soft'
                      : 'border-border hover:border-primary/30 bg-card'
                    }`}
                >
                  <span
                    className="text-foreground font-medium"
                    style={{ fontSize: `${size.scale * 14}px` }}
                  >
                    {size.name}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Info */}
          <div className="text-xs text-muted-foreground text-center pt-4 border-t border-border">
            🔒 数据仅保存于本地，安全无忧
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
