import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shuffle, LayoutGrid, Save, Palette, QrCode } from 'lucide-react';
import ExportButtons from '@/components/ExportButtons';
import SeatCheckinDialog from '@/components/SeatCheckinDialog';

interface Props {
  students: { id: string; name: string }[];
}

type LayoutMode = 'radial' | 'concentric';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function ArtStudio({ students }: Props) {
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('radial');
  const [ringCount, setRingCount] = useState(3);
  const [innerRingSeats, setInnerRingSeats] = useState(8);
  const [ringGrowth, setRingGrowth] = useState(4);
  const [useStaggerHint, setUseStaggerHint] = useState(true);
  const [assignment, setAssignment] = useState<string[][]>([]);
  const [recordName, setRecordName] = useState('');
  const [checkinOpen, setCheckinOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const seatsPerRing = useMemo(() => {
    return Array.from({ length: ringCount }, (_, ring) => {
      if (layoutMode === 'concentric') return innerRingSeats;
      return innerRingSeats + ring * ringGrowth;
    });
  }, [innerRingSeats, layoutMode, ringCount, ringGrowth]);

  const totalCapacity = useMemo(() => seatsPerRing.reduce((sum, item) => sum + item, 0), [seatsPerRing]);

  const autoSeat = (shuffle = false) => {
    const names = shuffle
      ? [...students.map(student => student.name)].sort(() => Math.random() - 0.5)
      : students.map(student => student.name);

    const next = seatsPerRing.map(count => Array.from({ length: count }, () => ''));
    let cursor = 0;
    for (let ring = 0; ring < next.length; ring++) {
      for (let i = 0; i < next[ring].length; i++) {
        if (cursor >= names.length) break;
        next[ring][i] = names[cursor++];
      }
    }
    setAssignment(next);
  };

  const clearAll = () => {
    setAssignment(seatsPerRing.map(count => Array.from({ length: count }, () => '')));
  };

  const seatData = assignment.length > 0
    ? assignment
    : seatsPerRing.map(count => Array.from({ length: count }, () => ''));

  const layoutName = layoutMode === 'radial' ? '辐射状' : '同心圆';

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-foreground flex items-center gap-2">
            <Palette className="w-5 h-5 text-primary" /> 美术教室
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">核心写生区采用 {layoutName} 布局，支持快速调整环数与每环席位。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => autoSeat(false)}>
            <LayoutGrid className="w-3.5 h-3.5" /> 自动排座
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => autoSeat(true)}>
            <Shuffle className="w-3.5 h-3.5" /> 随机排座
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={clearAll}>
            清空
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setCheckinOpen(true)}>
            <QrCode className="w-3.5 h-3.5" /> 签到
          </Button>
          <ExportButtons targetRef={printRef as React.RefObject<HTMLElement>} filename="美术教室座位图" hideTitleInput={false} titleValue={recordName} onTitleChange={setRecordName} />
        </div>
      </div>

      <div className="rounded-xl border border-border p-3 sm:p-4 bg-card/70 space-y-3">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            布局
            <select
              className="h-8 px-2 rounded-md border border-input bg-background text-foreground"
              value={layoutMode}
              onChange={e => setLayoutMode(e.target.value as LayoutMode)}
            >
              <option value="radial">辐射状</option>
              <option value="concentric">同心圆</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            环数
            <Input type="number" className="h-8 w-16 text-center" min={2} max={5} value={ringCount}
              onChange={e => setRingCount(clamp(Number(e.target.value) || 3, 2, 5))} />
          </label>
          <label className="flex items-center gap-2">
            内环席位
            <Input type="number" className="h-8 w-16 text-center" min={6} max={16} value={innerRingSeats}
              onChange={e => setInnerRingSeats(clamp(Number(e.target.value) || 8, 6, 16))} />
          </label>
          <label className="flex items-center gap-2">
            外环增量
            <Input type="number" className="h-8 w-16 text-center" min={0} max={8} value={ringGrowth}
              onChange={e => setRingGrowth(clamp(Number(e.target.value) || 0, 0, 8))} />
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="accent-primary" checked={useStaggerHint} onChange={e => setUseStaggerHint(e.target.checked)} />
            前低后高错落提示
          </label>
        </div>
        <p className="text-xs text-muted-foreground">容量 {totalCapacity} 座 · 当前学生 {students.length} 人 · 核心区：写生区（静物/石膏像/人物模特）</p>
      </div>

      <div ref={printRef} className="rounded-2xl border border-border bg-background p-3 sm:p-5">
        <div className="grid grid-cols-12 gap-2 text-xs mb-3">
          <div className="col-span-4 rounded-lg border border-border bg-muted/40 p-2">
            <div className="font-semibold text-foreground">教师办公区</div>
            <div className="text-muted-foreground mt-1">讲台 / 备课</div>
          </div>
          <div className="col-span-5 rounded-lg border border-border bg-primary/5 p-2">
            <div className="font-semibold text-foreground">多媒体教学区</div>
            <div className="text-muted-foreground mt-1">白板 / 投影幕</div>
          </div>
          <div className="col-span-3 rounded-lg border border-border bg-muted/40 p-2">
            <div className="font-semibold text-foreground">窗户（北向）</div>
            <div className="text-muted-foreground mt-1">自然光</div>
          </div>
        </div>

        <div className="relative rounded-xl border border-border bg-[linear-gradient(180deg,rgba(250,250,245,0.95)_0%,rgba(245,247,250,0.92)_100%)] min-h-[520px] overflow-hidden">
          <div className="absolute left-3 top-3 rounded-md bg-primary/10 border border-primary/20 px-2 py-1 text-xs text-primary font-medium">写生区（核心）</div>

          <div className="absolute right-3 top-16 w-28 rounded-lg border border-border bg-white/80 p-2 text-[11px]">
            <div className="font-semibold">写生区</div>
            <ul className="mt-1 space-y-0.5 text-muted-foreground">
              <li>• 模特台</li>
              <li>• 静物台</li>
              <li>• 可升降</li>
            </ul>
          </div>

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border-2 border-primary/50 bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shadow-sm">
            模特/静物台
          </div>

          {seatData.map((ring, ringIndex) => {
            const radius = 70 + ringIndex * 58;
            const startAngle = -Math.PI / 2 + (layoutMode === 'concentric' ? (ringIndex % 2 === 0 ? 0 : Math.PI / ring.length) : 0);

            return ring.map((name, seatIndex) => {
              const angle = startAngle + (2 * Math.PI * seatIndex) / ring.length;
              const x = Math.cos(angle) * radius;
              const y = Math.sin(angle) * radius;
              const isFront = y < -20;

              return (
                <div
                  key={`ring-${ringIndex}-seat-${seatIndex}`}
                  className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-10 rounded-md border text-[11px] flex items-center justify-center px-1 text-center leading-tight ${name ? 'bg-white border-primary/40 text-foreground shadow-sm' : 'bg-muted/50 border-border text-muted-foreground'} ${useStaggerHint && isFront ? 'opacity-85' : ''}`}
                  style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
                  title={name || `第${ringIndex + 1}环 第${seatIndex + 1}位`}
                >
                  {name || '画架位'}
                </div>
              );
            });
          })}
        </div>

        <div className="grid grid-cols-12 gap-2 text-xs mt-3">
          <div className="col-span-3 rounded-lg border border-border bg-muted/40 p-2">
            <div className="font-semibold">清洗区</div>
            <div className="text-muted-foreground mt-1">深水槽 / 废油桶</div>
          </div>
          <div className="col-span-6 rounded-lg border border-dashed border-border bg-background p-2 text-center text-muted-foreground">主干道（机动调整通道）</div>
          <div className="col-span-3 rounded-lg border border-border bg-muted/40 p-2">
            <div className="font-semibold">晾干区</div>
            <div className="text-muted-foreground mt-1">展示架 / 网格墙</div>
          </div>

          <div className="col-span-3 rounded-lg border border-border bg-muted/40 p-2">
            <div className="font-semibold">储藏区</div>
            <div className="text-muted-foreground mt-1">石膏柜 / 画材货架</div>
          </div>
          <div className="col-span-6 rounded-lg border border-border bg-primary/5 p-2">
            <div className="font-semibold">平涂创作区</div>
            <div className="text-muted-foreground mt-1">大工作台（靠墙）/ 墙壁软木板</div>
          </div>
          <div className="col-span-3 rounded-lg border border-border bg-muted/40 p-2">
            <div className="font-semibold">储藏区</div>
            <div className="text-muted-foreground mt-1">个人柜 / 画架库</div>
          </div>
        </div>

        {useStaggerHint && (
          <p className="mt-3 text-xs text-muted-foreground">提示：空间紧张时可采用“前排矮凳、后排站立画架”的错落策略，减少遮挡并保证视角。</p>
        )}
      </div>

      <SeatCheckinDialog
        open={checkinOpen}
        onOpenChange={setCheckinOpen}
        seatData={seatData}
        studentNames={students.map(s => s.name)}
        sceneConfig={{ layoutMode, ringCount, innerRingSeats, ringGrowth }}
        sceneType="artStudio"
        className="美术教室"
        pngFileName="美术教室签到码"
      />
    </div>
  );
}
