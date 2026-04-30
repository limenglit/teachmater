import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shuffle, LayoutGrid, Palette, QrCode, Orbit, Move, UserRound } from 'lucide-react';
import ExportButtons from '@/components/ExportButtons';
import SeatCheckinDialog from '@/components/SeatCheckinDialog';
import { useLanguage, tFormat } from '@/contexts/LanguageContext';

interface Props {
  students: { id: string; name: string; organization?: string; title?: string }[];
}

type LayoutMode = 'radial' | 'concentric';
type PresetType = 'stillLife' | 'plaster' | 'model';
type LayerRule = 'default' | 'height' | 'grade';

interface Point {
  x: number;
  y: number;
}

interface DragState {
  kind: 'seat' | 'platform' | 'marker';
  key: string;
}

const CANVAS_W = 900;
const CANVAS_H = 560;
const SEAT_W = 40;
const SEAT_H = 22;
const SEAT_COLLISION_DIST = 44;
const CENTER_SAFE_RADIUS = 62;
const CENTER_DEFAULT: Point = { x: 450, y: 280 };
const MARKER_DEFAULT = {
  window: { x: 720, y: 24 },
  door: { x: 834, y: 266 },
};
const CHINESE_NUMERAL_MAP: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const parseHeightFromText = (text: string): number | null => {
  const normalized = text.toLowerCase();
  const cmMatch = normalized.match(/(1[4-9]\d|2[0-2]\d)\s*cm/);
  if (cmMatch) return Number(cmMatch[1]);

  const zhMatch = normalized.match(/身高\s*[:：]?\s*(1[4-9]\d|2[0-2]\d)/);
  if (zhMatch) return Number(zhMatch[1]);
  return null;
};

const parseGradeFromText = (text: string): number | null => {
  const normalized = text.toLowerCase();
  const digitMatch = normalized.match(/(?:grade\s*|g\s*|年级\s*|级\s*)(\d{1,2})|(?:^|\s)(\d{1,2})\s*年级/);
  const digitRaw = digitMatch?.[1] || digitMatch?.[2];
  if (digitRaw) return Number(digitRaw);

  const zhMatch = text.match(/([一二三四五六七八九十])年级/);
  if (zhMatch && CHINESE_NUMERAL_MAP[zhMatch[1]]) return CHINESE_NUMERAL_MAP[zhMatch[1]];
  return null;
};

const angularDistance = (a: number, b: number) => {
  const diff = Math.abs(a - b) % (Math.PI * 2);
  return diff > Math.PI ? Math.PI * 2 - diff : diff;
};

const buildSeatCounts = (layoutMode: LayoutMode, ringCount: number, innerRingSeats: number, ringGrowth: number) => {
  return Array.from({ length: ringCount }, (_, ring) => {
    if (layoutMode === 'concentric') return innerRingSeats;
    return innerRingSeats + ring * ringGrowth;
  });
};

const getOffsets = (layoutMode: LayoutMode, seatCounts: number[], optimizeView: boolean) => {
  const offsets = seatCounts.map((count, ring) => {
    if (layoutMode === 'concentric') return ring % 2 === 0 ? 0 : Math.PI / Math.max(1, count);
    return ring % 2 === 0 ? 0 : Math.PI / Math.max(1, count * 2);
  });

  if (!optimizeView || seatCounts.length <= 1) return offsets;

  for (let ring = 1; ring < seatCounts.length; ring++) {
    const prevCount = seatCounts[ring - 1];
    const currentCount = seatCounts[ring];
    if (!prevCount || !currentCount) continue;

    const prevAngles = Array.from({ length: prevCount }, (_, i) => offsets[ring - 1] + (2 * Math.PI * i) / prevCount);
    const step = (2 * Math.PI) / currentCount;
    let bestOffset = offsets[ring];
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let k = 0; k < currentCount; k++) {
      const candidate = offsets[ring] + k * step;
      const currAngles = Array.from({ length: currentCount }, (_, i) => candidate + (2 * Math.PI * i) / currentCount);

      let score = 0;
      for (const currAngle of currAngles) {
        const minDist = prevAngles.reduce((min, prevAngle) => Math.min(min, angularDistance(currAngle, prevAngle)), Number.POSITIVE_INFINITY);
        score += minDist;
      }

      if (score > bestScore) {
        bestScore = score;
        bestOffset = candidate;
      }
    }

    offsets[ring] = bestOffset;
  }

  return offsets;
};

const buildRadii = (seatCounts: number[]) => {
  const radii: number[] = [];
  let previous = 0;
  for (let ring = 0; ring < seatCounts.length; ring++) {
    const count = seatCounts[ring];
    const byCircumference = (count * (SEAT_W * 0.9)) / (2 * Math.PI);
    const base = 102 + ring * 68;
    const radius = Math.max(base, byCircumference, previous + SEAT_H + 28);
    radii.push(radius);
    previous = radius;
  }
  return radii;
};

const resolveSeatCollisions = (
  input: Record<string, Point>,
  fixed: Set<string>,
  model: Point,
  stillLife: Point,
) => {
  const keys = Object.keys(input);
  const output: Record<string, Point> = {};
  keys.forEach(key => {
    const p = input[key];
    output[key] = { x: p.x, y: p.y };
  });

  const repelFromCenterZone = (point: Point, zoneCenter: Point, radius: number) => {
    const dx = point.x - zoneCenter.x;
    const dy = point.y - zoneCenter.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
    if (dist >= radius) return;
    const push = radius - dist;
    point.x += (dx / dist) * push;
    point.y += (dy / dist) * push;
  };

  for (let iter = 0; iter < 80; iter++) {
    let moved = false;

    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const aKey = keys[i];
        const bKey = keys[j];
        const a = output[aKey];
        const b = output[bKey];

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        if (dist >= SEAT_COLLISION_DIST) continue;

        const push = (SEAT_COLLISION_DIST - dist) / 2;
        const ux = dx / dist;
        const uy = dy / dist;

        if (!fixed.has(aKey)) {
          a.x -= ux * push;
          a.y -= uy * push;
          moved = true;
        }
        if (!fixed.has(bKey)) {
          b.x += ux * push;
          b.y += uy * push;
          moved = true;
        }
      }
    }

    for (const key of keys) {
      if (fixed.has(key)) continue;
      const p = output[key];
      repelFromCenterZone(p, model, CENTER_SAFE_RADIUS + 24);
      repelFromCenterZone(p, stillLife, CENTER_SAFE_RADIUS + 24);
      p.x = clamp(p.x, 14 + SEAT_W / 2, CANVAS_W - 14 - SEAT_W / 2);
      p.y = clamp(p.y, 14 + SEAT_H / 2, CANVAS_H - 14 - SEAT_H / 2);
    }

    if (!moved) break;
  }

  return output;
};

export default function ArtStudio({ students }: Props) {
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('radial');
  const [ringCount, setRingCount] = useState(3);
  const [innerRingSeats, setInnerRingSeats] = useState(8);
  const [ringGrowth, setRingGrowth] = useState(4);
  const [enableLayeredStrategy, setEnableLayeredStrategy] = useState(true);
  const [optimizeView, setOptimizeView] = useState(true);
  const [preset, setPreset] = useState<PresetType>('stillLife');
  const [layerRule, setLayerRule] = useState<LayerRule>('default');
  const [assignment, setAssignment] = useState<string[][]>([]);
  const [seatPositions, setSeatPositions] = useState<Record<string, Point>>({});
  const [platforms, setPlatforms] = useState<{ model: Point; stillLife: Point }>({
    model: { x: CENTER_DEFAULT.x + 44, y: CENTER_DEFAULT.y - 10 },
    stillLife: { x: CENTER_DEFAULT.x - 44, y: CENTER_DEFAULT.y + 10 },
  });
  const [markers, setMarkers] = useState<{ window: Point; door: Point }>({
    window: { ...MARKER_DEFAULT.window },
    door: { ...MARKER_DEFAULT.door },
  });
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [recordName, setRecordName] = useState('');
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [showPeripheralZones, setShowPeripheralZones] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  const seatsPerRing = useMemo(
    () => buildSeatCounts(layoutMode, ringCount, innerRingSeats, ringGrowth),
    [innerRingSeats, layoutMode, ringCount, ringGrowth],
  );

  const ringOffsets = useMemo(
    () => getOffsets(layoutMode, seatsPerRing, optimizeView),
    [layoutMode, optimizeView, seatsPerRing],
  );

  const ringRadii = useMemo(() => buildRadii(seatsPerRing), [seatsPerRing]);

  const totalCapacity = useMemo(() => seatsPerRing.reduce((sum, item) => sum + item, 0), [seatsPerRing]);

  const studentsWithMeta = useMemo(() => {
    return students.map((student, index) => {
      const text = `${student.name} ${student.organization || ''} ${student.title || ''}`;
      return {
        ...student,
        index,
        height: parseHeightFromText(text),
        grade: parseGradeFromText(text),
      };
    });
  }, [students]);

  const parsedStats = useMemo(() => {
    const heightKnown = studentsWithMeta.filter(item => item.height !== null).length;
    const gradeKnown = studentsWithMeta.filter(item => item.grade !== null).length;
    return { heightKnown, gradeKnown };
  }, [studentsWithMeta]);

  const frontRingThreshold = useMemo(() => Math.max(0, Math.floor((ringCount - 1) / 2)), [ringCount]);

  const seatNodes = useMemo(() => {
    const nodes: Array<{ key: string; ringIndex: number; seatIndex: number; x: number; y: number; layer: 'stool' | 'standing' }> = [];
    seatsPerRing.forEach((count, ringIndex) => {
      const radius = ringRadii[ringIndex];
      const startAngle = ringOffsets[ringIndex];
      const layer: 'stool' | 'standing' = enableLayeredStrategy && ringIndex <= frontRingThreshold ? 'stool' : 'standing';
      for (let seatIndex = 0; seatIndex < count; seatIndex++) {
        const angle = startAngle + (2 * Math.PI * seatIndex) / count;
        const x = CENTER_DEFAULT.x + Math.cos(angle) * radius;
        const y = CENTER_DEFAULT.y + Math.sin(angle) * radius;
        nodes.push({ key: `${ringIndex}-${seatIndex}`, ringIndex, seatIndex, x, y, layer });
      }
    });
    return nodes;
  }, [enableLayeredStrategy, frontRingThreshold, ringOffsets, ringRadii, seatsPerRing]);

  const seatNodeMap = useMemo(() => {
    const map = new Map<string, { ringIndex: number; seatIndex: number; layer: 'stool' | 'standing' }>();
    seatNodes.forEach(node => {
      map.set(node.key, { ringIndex: node.ringIndex, seatIndex: node.seatIndex, layer: node.layer });
    });
    return map;
  }, [seatNodes]);

  const ensureAssignmentShape = useCallback((source: string[][]) => {
    return seatsPerRing.map((count, ringIndex) => {
      const ring = source[ringIndex] || [];
      return Array.from({ length: count }, (_, seatIndex) => ring[seatIndex] || '');
    });
  }, [seatsPerRing]);

  const getOrderedNamesByRule = useCallback((rule: LayerRule) => {
    if (rule === 'default') return studentsWithMeta.map(item => item.name);

    if (rule === 'height') {
      const known = studentsWithMeta.filter(item => item.height !== null)
        .sort((a, b) => (a.height as number) - (b.height as number) || a.index - b.index);
      const unknown = studentsWithMeta.filter(item => item.height === null).sort((a, b) => a.index - b.index);
      return [...known, ...unknown].map(item => item.name);
    }

    const known = studentsWithMeta.filter(item => item.grade !== null)
      .sort((a, b) => (a.grade as number) - (b.grade as number) || a.index - b.index);
    const unknown = studentsWithMeta.filter(item => item.grade === null).sort((a, b) => a.index - b.index);
    return [...known, ...unknown].map(item => item.name);
  }, [studentsWithMeta]);

  useEffect(() => {
    setAssignment(prev => ensureAssignmentShape(prev));
  }, [ensureAssignmentShape]);

  const regeneratePositions = useCallback((forceReset = false) => {
    setSeatPositions(prev => {
      const base: Record<string, Point> = {};
      for (const node of seatNodes) {
        const inherited = !forceReset ? prev[node.key] : undefined;
        base[node.key] = inherited ? { ...inherited } : { x: node.x, y: node.y };
      }
      const fixed = forceReset ? new Set<string>() : new Set(Object.keys(prev));
      return resolveSeatCollisions(base, fixed, platforms.model, platforms.stillLife);
    });
  }, [platforms.model, platforms.stillLife, seatNodes]);

  useEffect(() => {
    regeneratePositions(false);
  }, [regeneratePositions]);

  const autoSeat = (shuffle = false) => {
    const names = shuffle
      ? [...students.map(student => student.name)].sort(() => Math.random() - 0.5)
      : getOrderedNamesByRule(layerRule);

    const next = ensureAssignmentShape([]);
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
    setAssignment(ensureAssignmentShape([]));
  };

  const resetMarkers = () => {
    setMarkers({
      window: { ...MARKER_DEFAULT.window },
      door: { ...MARKER_DEFAULT.door },
    });
  };

  const swapMarkerSides = () => {
    setMarkers(prev => ({
      window: { x: CANVAS_W - prev.window.x, y: prev.window.y },
      door: { x: CANVAS_W - prev.door.x, y: prev.door.y },
    }));
  };

  const applyPreset = (nextPreset: PresetType) => {
    setPreset(nextPreset);
    if (nextPreset === 'stillLife') {
      setLayoutMode('concentric');
      setRingCount(3);
      setInnerRingSeats(10);
      setRingGrowth(2);
      setEnableLayeredStrategy(true);
      setOptimizeView(true);
      setPlatforms({
        model: { x: CENTER_DEFAULT.x + 58, y: CENTER_DEFAULT.y - 8 },
        stillLife: { x: CENTER_DEFAULT.x - 48, y: CENTER_DEFAULT.y + 12 },
      });
      return;
    }

    if (nextPreset === 'plaster') {
      setLayoutMode('radial');
      setRingCount(4);
      setInnerRingSeats(8);
      setRingGrowth(4);
      setEnableLayeredStrategy(true);
      setOptimizeView(true);
      setPlatforms({
        model: { x: CENTER_DEFAULT.x + 32, y: CENTER_DEFAULT.y - 18 },
        stillLife: { x: CENTER_DEFAULT.x - 58, y: CENTER_DEFAULT.y + 18 },
      });
      return;
    }

    setLayoutMode('radial');
    setRingCount(3);
    setInnerRingSeats(9);
    setRingGrowth(5);
    setEnableLayeredStrategy(true);
    setOptimizeView(true);
    setPlatforms({
      model: { x: CENTER_DEFAULT.x + 62, y: CENTER_DEFAULT.y - 6 },
      stillLife: { x: CENTER_DEFAULT.x - 40, y: CENTER_DEFAULT.y + 16 },
    });
  };

  const toCanvasPoint = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: clamp(clientX - rect.left, 0, CANVAS_W),
      y: clamp(clientY - rect.top, 0, CANVAS_H),
    };
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const onPointerMove = (event: PointerEvent) => {
      const point = toCanvasPoint(event.clientX, event.clientY);
      if (!point) return;

      if (dragging.kind === 'seat') {
        setSeatPositions(prev => {
          const next = { ...prev };
          next[dragging.key] = {
            x: clamp(point.x, 14 + SEAT_W / 2, CANVAS_W - 14 - SEAT_W / 2),
            y: clamp(point.y, 14 + SEAT_H / 2, CANVAS_H - 14 - SEAT_H / 2),
          };
          return next;
        });
        return;
      }

      if (dragging.kind === 'marker') {
        setMarkers(prev => {
          const next = { ...prev };
          next[dragging.key as 'window' | 'door'] = {
            x: clamp(point.x, 32, CANVAS_W - 32),
            y: clamp(point.y, 18, CANVAS_H - 24),
          };
          return next;
        });
        return;
      }

      setPlatforms(prev => {
        const next = { ...prev };
        next[dragging.key as 'model' | 'stillLife'] = {
          x: clamp(point.x, 70, CANVAS_W - 70),
          y: clamp(point.y, 70, CANVAS_H - 70),
        };
        return next;
      });
    };

    const onPointerUp = () => {
      if (dragging.kind === 'seat') {
        setSeatPositions(prev => resolveSeatCollisions(prev, new Set([dragging.key]), platforms.model, platforms.stillLife));
      }
      setDragging(null);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [dragging, platforms.model, platforms.stillLife, toCanvasPoint]);

  const seatData = assignment.length > 0
    ? assignment
    : ensureAssignmentShape([]);

  const layoutName = layoutMode === 'radial' ? '辐射状' : '同心圆';

  const resolveSeatPoint = (key: string, fallbackX: number, fallbackY: number) => {
    const p = seatPositions[key];
    return p ? p : { x: fallbackX, y: fallbackY };
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="relative group w-fit">
          <h2 className="text-lg sm:text-xl font-semibold text-foreground flex items-center gap-2">
            <Palette className="w-5 h-5 text-primary" /> 美术教室
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">核心写生区采用 {layoutName} 布局，支持预设、分层、视角优化与拖拽微调。</p>
          <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden w-[min(92vw,620px)] rounded-lg border border-border bg-background/95 px-3 py-2 text-xs text-muted-foreground shadow-md group-hover:block">
            <p>容量 {totalCapacity} 座 · 当前学生 {students.length} 人 · 核心区：写生区（静物/石膏像/人物模特） · 支持拖拽：画架位、模特台、静物台</p>
            <p className="mt-1">可识别数据：身高 {parsedStats.heightKnown}/{students.length} 人，年级 {parsedStats.gradeKnown}/{students.length} 人（从学生“职务/单位/姓名”文本解析，未识别者将顺延外环）。</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => autoSeat(false)}>
            <LayoutGrid className="w-3.5 h-3.5" /> 自动排座
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => autoSeat(true)}>
            <Shuffle className="w-3.5 h-3.5" /> 随机排座
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => { if (window.confirm('确定要清空当前所有座位安排吗？此操作不可撤销。')) clearAll(); }}>
            清空
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => regeneratePositions(true)}>
            <Orbit className="w-3.5 h-3.5" /> 视角优化
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setShowPeripheralZones(prev => !prev)}>
            {showPeripheralZones ? '隐藏外围区域' : '显示外围区域'}
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setCheckinOpen(true)}>
            <QrCode className="w-3.5 h-3.5" /> 签到
          </Button>
          <ExportButtons targetRef={printRef as React.RefObject<HTMLElement>} filename="美术教室座位图" hideTitleInput={false} titleValue={recordName} onTitleChange={setRecordName} />
        </div>
      </div>

      <div className="rounded-xl border border-border p-3 sm:p-4 bg-card/70 space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">一键预设:</span>
          <Button variant={preset === 'stillLife' ? 'default' : 'outline'} size="sm" className="h-7 px-2" onClick={() => applyPreset('stillLife')}>静物写生</Button>
          <Button variant={preset === 'plaster' ? 'default' : 'outline'} size="sm" className="h-7 px-2" onClick={() => applyPreset('plaster')}>石膏像写生</Button>
          <Button variant={preset === 'model' ? 'default' : 'outline'} size="sm" className="h-7 px-2" onClick={() => applyPreset('model')}>
            <UserRound className="w-3 h-3 mr-1" /> 人物模特写生
          </Button>
        </div>

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
            <input type="checkbox" className="accent-primary" checked={enableLayeredStrategy} onChange={e => setEnableLayeredStrategy(e.target.checked)} />
            分层策略（前排矮凳 / 后排站立）
          </label>
          <label className="flex items-center gap-2">
            分层依据
            <select className="h-8 px-2 rounded-md border border-input bg-background text-foreground" value={layerRule} onChange={e => setLayerRule(e.target.value as LayerRule)}>
              <option value="default">默认（名单顺序）</option>
              <option value="height">按身高（矮到高：内环到外环）</option>
              <option value="grade">按年级（低到高：内环到外环）</option>
            </select>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="accent-primary" checked={optimizeView} onChange={e => setOptimizeView(e.target.checked)} />
            启用视角遮挡评分优化
          </label>
        </div>
      </div>

      <div ref={printRef} className="rounded-2xl border border-border bg-background p-3 sm:p-5">
        {showPeripheralZones && (
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
            <div className="font-semibold text-foreground">门窗参照</div>
            <div className="text-muted-foreground mt-1">画布内可拖拽调整</div>
          </div>
        </div>
        )}

        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">门窗位置:</span>
          <Button variant="outline" size="sm" className="h-7 px-2" onClick={swapMarkerSides}>左右互换</Button>
          <Button variant="outline" size="sm" className="h-7 px-2" onClick={resetMarkers}>重置</Button>
        </div>

        <div ref={canvasRef} className="relative rounded-xl border border-border bg-[linear-gradient(180deg,rgba(250,250,245,0.95)_0%,rgba(245,247,250,0.92)_100%)] overflow-hidden mx-auto" style={{ width: `${CANVAS_W}px`, height: `${CANVAS_H}px` }}>
          <div className="absolute left-3 top-3 rounded-md bg-primary/10 border border-primary/20 px-2 py-1 text-xs text-primary font-medium">写生区（核心）</div>

          <div
            className="absolute inline-flex items-center gap-1 rounded-md border border-sky-400/40 bg-sky-100/90 px-2 py-1 text-[11px] text-sky-800 font-medium shadow-sm cursor-grab active:cursor-grabbing select-none"
            style={{ left: markers.window.x - 26, top: markers.window.y - 12 }}
            onPointerDown={e => { e.preventDefault(); setDragging({ kind: 'marker', key: 'window' }); }}
            title="拖拽移动窗户位置"
          >
            <span>🪟</span>
            <span>窗</span>
          </div>

          <div
            className="absolute inline-flex items-center gap-1 rounded-md border border-amber-600/35 bg-amber-100/90 px-2 py-1 text-[11px] text-amber-800 font-medium shadow-sm cursor-grab active:cursor-grabbing select-none"
            style={{ left: markers.door.x - 26, top: markers.door.y - 12 }}
            onPointerDown={e => { e.preventDefault(); setDragging({ kind: 'marker', key: 'door' }); }}
            title="拖拽移动门位置"
          >
            <span>🚪</span>
            <span>门</span>
          </div>

          <div className="absolute right-3 top-16 w-28 rounded-lg border border-border bg-white/80 p-2 text-[11px]">
            <div className="font-semibold">写生区</div>
            <ul className="mt-1 space-y-0.5 text-muted-foreground">
              <li>• 模特台</li>
              <li>• 静物台</li>
              <li>• 可升降</li>
            </ul>
          </div>

          <div
            className="absolute w-24 h-24 rounded-full border-2 border-primary/50 bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shadow-sm cursor-grab active:cursor-grabbing select-none"
            style={{ left: platforms.model.x - 48, top: platforms.model.y - 48 }}
            onPointerDown={e => { e.preventDefault(); setDragging({ kind: 'platform', key: 'model' }); }}
            title="拖拽移动模特台"
          >
            模特台
          </div>

          <div
            className="absolute w-20 h-20 rounded-full border-2 border-amber-500/50 bg-amber-100/70 flex items-center justify-center text-[11px] font-semibold text-amber-700 shadow-sm cursor-grab active:cursor-grabbing select-none"
            style={{ left: platforms.stillLife.x - 40, top: platforms.stillLife.y - 40 }}
            onPointerDown={e => { e.preventDefault(); setDragging({ kind: 'platform', key: 'stillLife' }); }}
            title="拖拽移动静物台"
          >
            静物台
          </div>

          {seatNodes.map(node => {
            const pos = resolveSeatPoint(node.key, node.x, node.y);
            const name = seatData[node.ringIndex]?.[node.seatIndex] || '';
            const layerText = node.layer === 'stool' ? '矮凳' : '站立画架';

            return (
              <div
                key={`seat-${node.key}`}
                className={`absolute rounded-md border text-[10px] flex items-center justify-center px-1 text-center leading-tight cursor-grab active:cursor-grabbing select-none ${name ? 'bg-white border-primary/40 text-foreground shadow-sm' : 'bg-muted/60 border-border text-muted-foreground'}`}
                style={{ left: pos.x - SEAT_W / 2, top: pos.y - SEAT_H / 2, width: `${SEAT_W}px`, height: `${SEAT_H}px` }}
                onPointerDown={e => { e.preventDefault(); setDragging({ kind: 'seat', key: node.key }); }}
                title={`${name || '空位'} · 第${node.ringIndex + 1}环第${node.seatIndex + 1}位 · ${layerText}`}
              >
                <span className="truncate w-full">{name || '画架'}</span>
              </div>
            );
          })}

          <div className="absolute right-3 bottom-3 rounded-md border border-border bg-background/80 px-2 py-1 text-[11px] text-muted-foreground flex items-center gap-1">
            <Move className="w-3 h-3" /> 拖拽可调整画架位、中心台与门窗标识
          </div>
        </div>

        {showPeripheralZones && (
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
        )}

        <p className="mt-3 text-xs text-muted-foreground">提示：系统会基于遮挡评分做角度错位优化，尽量减少同视线重叠；若需要，仍可拖拽手动微调。</p>
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
