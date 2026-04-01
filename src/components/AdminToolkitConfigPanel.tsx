import { useLanguage } from '@/contexts/LanguageContext';
import { Switch } from '@/components/ui/switch';

export type ToolkitToolId =
  | 'barrage' | 'countdown' | 'noise' | 'scoreboard' | 'randomAssigner'
  | 'lottery' | 'poll' | 'stopwatch' | 'trafficLight' | 'breathing'
  | 'textMagnifier' | 'screenCapture' | 'taskChecklist' | 'codeVisualizer'
  | 'imageEditor' | 'commandCards' | 'qrCode';

export interface ToolkitToolFlags {
  barrage: boolean; countdown: boolean; noise: boolean; scoreboard: boolean;
  randomAssigner: boolean; lottery: boolean; poll: boolean; stopwatch: boolean;
  trafficLight: boolean; breathing: boolean; textMagnifier: boolean;
  screenCapture: boolean; taskChecklist: boolean; codeVisualizer: boolean;
  imageEditor: boolean; commandCards: boolean; qrCode: boolean;
}

export const DEFAULT_TOOLKIT_TOOLS: ToolkitToolFlags = {
  barrage: true, countdown: true, noise: true, scoreboard: true,
  randomAssigner: true, lottery: true, poll: true, stopwatch: true,
  trafficLight: true, breathing: true, textMagnifier: true,
  screenCapture: true, taskChecklist: true, codeVisualizer: true,
  imageEditor: true, commandCards: true, qrCode: true,
};

const TOOLKIT_TOOL_KEYS: { key: ToolkitToolId; emoji: string; labelKey: string }[] = [
  { key: 'barrage', emoji: '💬', labelKey: 'toolkit.barrage' },
  { key: 'countdown', emoji: '⏱️', labelKey: 'toolkit.countdown' },
  { key: 'noise', emoji: '🔊', labelKey: 'toolkit.noise' },
  { key: 'scoreboard', emoji: '📊', labelKey: 'toolkit.scoreboard' },
  { key: 'randomAssigner', emoji: '🎲', labelKey: 'toolkit.randomAssigner' },
  { key: 'lottery', emoji: '🎰', labelKey: 'toolkit.lottery' },
  { key: 'poll', emoji: '📋', labelKey: 'toolkit.poll' },
  { key: 'stopwatch', emoji: '⏰', labelKey: 'toolkit.stopwatch' },
  { key: 'trafficLight', emoji: '🚦', labelKey: 'toolkit.trafficLight' },
  { key: 'breathing', emoji: '🧘', labelKey: 'toolkit.breathing' },
  { key: 'textMagnifier', emoji: '🔍', labelKey: 'toolkit.textMagnifier' },
  { key: 'screenCapture', emoji: '📸', labelKey: 'toolkit.screenCapture' },
  { key: 'taskChecklist', emoji: '✅', labelKey: 'toolkit.taskChecklist' },
  { key: 'codeVisualizer', emoji: '💻', labelKey: 'toolkit.codeVisualizer' },
  { key: 'imageEditor', emoji: '🖼️', labelKey: 'toolkit.imageEditor' },
  { key: 'commandCards', emoji: '📢', labelKey: 'toolkit.commandCards' },
  { key: 'qrCode', emoji: '📱', labelKey: 'toolkit.qrCode' },
];

interface Props {
  userType: 'guest' | 'registered';
  label: string;
  tools: ToolkitToolFlags;
  onToggle: (userType: 'guest' | 'registered', key: ToolkitToolId) => void;
}

export default function AdminToolkitConfigPanel({ userType, label, tools, onToggle }: Props) {
  const { t } = useLanguage();

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        🧰 {label} - {t('sysconfig.toolkitTools')}
      </h3>
      <p className="text-xs text-muted-foreground mb-3">{t('sysconfig.toolkitDesc')}</p>
      <div className="grid grid-cols-2 gap-2">
        {TOOLKIT_TOOL_KEYS.map(({ key, emoji, labelKey }) => (
          <div key={key} className="flex items-center justify-between p-2 rounded-lg bg-surface border border-border">
            <span className="text-xs flex items-center gap-1.5">
              <span>{emoji}</span>
              <span>{t(labelKey)}</span>
            </span>
            <Switch
              checked={tools[key] !== false}
              onCheckedChange={() => onToggle(userType, key)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
