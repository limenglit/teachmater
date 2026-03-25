import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useStudents } from '@/contexts/StudentContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LayoutGrid, ArrowDownUp, ArrowLeftRight, Columns, Rows, Grid3X3, Shuffle, BookOpen, X, ArrowRightLeft, Plus, Minus, PanelLeft, QrCode, ClipboardCheck, Save, RotateCcw } from 'lucide-react';
import ExportButtons from '@/components/ExportButtons';
import SeatCheckinDialog from '@/components/SeatCheckinDialog';
import SmartClassroom from '@/components/seating/SmartClassroom';
import ConferenceRoom from '@/components/seating/ConferenceRoom';
import ConcertHall from '@/components/seating/ConcertHall';
import BanquetHall from '@/components/seating/BanquetHall';
import ComputerLab from '@/components/seating/ComputerLab';
import ArtStudio from '@/components/seating/ArtStudio';
import { useSeatExportQr } from '@/components/seating/useSeatExportQr';
import { splitIntoGroups, findNextFree, getVisualRow as getVisualRowUtil } from '@/lib/seat-utils';
import { toast } from 'sonner';
import {
  loadClassroomSnapshot,
  saveClassroomSnapshot,
  loadClassroomHistory,
  saveClassroomHistory,
  loadLastGroups,
  loadLastTeams,
  type ClassroomHistoryItem,
} from '@/lib/teamwork-local';

type SceneType = 'classroom' | 'smartClassroom' | 'conference' | 'concertHall' | 'banquet' | 'computerLab' | 'artStudio';
type SeatMode = 'verticalS' | 'horizontalS' | 'groupCol' | 'groupRow' | 'smartCluster' | 'random' | 'exam';
type EntryDoorMode = 'front' | 'back' | 'both';
type StartFrom = 'door' | 'window' | 'center';
type GenderSeatPolicy = 'none' | 'alternate' | 'cluster' | 'alternateRows';
type GenderFirst = 'male' | 'female';
type GenderMarkerStyle = 'suffix' | 'badge';
type SeatGroupSource = 'auto' | 'groups' | 'teams' | 'count';
type SmartClusterStrategy = 'classic' | 'orgFrontWeighted';

const ORGANIZATION_COLOR_CLASSES = [
  'text-sky-700 dark:text-sky-300',
  'text-emerald-700 dark:text-emerald-300',
  'text-amber-700 dark:text-amber-300',
  'text-rose-700 dark:text-rose-300',
  'text-violet-700 dark:text-violet-300',
  'text-cyan-700 dark:text-cyan-300',
  'text-lime-700 dark:text-lime-300',
  'text-orange-700 dark:text-orange-300',
  'text-fuchsia-700 dark:text-fuchsia-300',
  'text-teal-700 dark:text-teal-300',
];

export default function SeatChart() {
  const { students } = useStudents();
  const { t } = useLanguage();

  const SCENES: { id: SceneType; label: string; desc: string }[] = [
    { id: 'classroom', label: t('scene.classroom'), desc: t('scene.classroomDesc') },
    { id: 'smartClassroom', label: t('scene.smartClassroom'), desc: t('scene.smartClassroomDesc') },
    { id: 'conference', label: t('scene.conference'), desc: t('scene.conferenceDesc') },
    { id: 'concertHall', label: t('scene.concertHall'), desc: t('scene.concertHallDesc') },
    { id: 'banquet', label: t('scene.banquet'), desc: t('scene.banquetDesc') },
    { id: 'computerLab', label: t('scene.computerLab'), desc: t('scene.computerLabDesc') },
    { id: 'artStudio', label: t('scene.artStudio'), desc: t('scene.artStudioDesc') },
  ];

  const MODES: { id: SeatMode; label: string; icon: React.ReactNode; desc: string }[] = [
    { id: 'verticalS', label: t('seatMode.verticalS'), icon: <ArrowDownUp className="w-3.5 h-3.5" />, desc: t('seatMode.verticalSDesc') },
    { id: 'horizontalS', label: t('seatMode.horizontalS'), icon: <ArrowLeftRight className="w-3.5 h-3.5" />, desc: t('seatMode.horizontalSDesc') },
    { id: 'groupCol', label: t('seatMode.groupCol'), icon: <Columns className="w-3.5 h-3.5" />, desc: t('seatMode.groupColDesc') },
    { id: 'groupRow', label: t('seatMode.groupRow'), icon: <Rows className="w-3.5 h-3.5" />, desc: t('seatMode.groupRowDesc') },
    { id: 'smartCluster', label: t('seatMode.smartCluster'), icon: <Grid3X3 className="w-3.5 h-3.5" />, desc: t('seatMode.smartClusterDesc') },
    { id: 'random', label: t('seatMode.random'), icon: <Shuffle className="w-3.5 h-3.5" />, desc: t('seatMode.randomDesc') },
    { id: 'exam', label: t('seatMode.exam'), icon: <BookOpen className="w-3.5 h-3.5" />, desc: t('seatMode.examDesc') },
  ];

  const [entryDoorMode, setEntryDoorMode] = useState<EntryDoorMode>('front');
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [scene, setScene] = useState<SceneType>('classroom');
  const [rows, setRows] = useState(10);
  const [cols, setCols] = useState(8);
  const [seats, setSeats] = useState<(string | null)[][]>([]);
  const [recordName, setRecordName] = useState('');
  const [historyItems, setHistoryItems] = useState<ClassroomHistoryItem[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState('');
  const [mode, setMode] = useState<SeatMode>('verticalS');
  const [groupCount, setGroupCount] = useState(4);
  const [groupSource, setGroupSource] = useState<SeatGroupSource>('auto');
  const [smartClusterStrategy, setSmartClusterStrategy] = useState<SmartClusterStrategy>('orgFrontWeighted');
  const [disabledSeats, setDisabledSeats] = useState<Set<string>>(new Set());
  const [examSkipRow, setExamSkipRow] = useState(true);
  const [examSkipCol, setExamSkipCol] = useState(false);
  const [dragFrom, setDragFrom] = useState<{ r: number; c: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ r: number; c: number } | null>(null);
  const [windowOnLeft, setWindowOnLeft] = useState(true);
  // 新增：前门/后门位置设置
  type DoorPosition = 'top' | 'bottom' | 'left' | 'right';
  const [frontDoorPosition, setFrontDoorPosition] = useState<DoorPosition>('top');
  const [backDoorPosition, setBackDoorPosition] = useState<DoorPosition>('bottom');
  const [startFrom, setStartFrom] = useState<StartFrom>('door');
  const [genderSeatPolicy, setGenderSeatPolicy] = useState<GenderSeatPolicy>('none');
  const [genderFirst, setGenderFirst] = useState<GenderFirst>('male');
  const [centerRowsByGender, setCenterRowsByGender] = useState(true);
  const [genderMarkerStyle, setGenderMarkerStyle] = useState<GenderMarkerStyle>('suffix');

  const [colAisles, setColAisles] = useState<number[]>([]);
  const [rowAisles, setRowAisles] = useState<number[]>([]);
  const [draggingAisle, setDraggingAisle] = useState<{ type: 'row' | 'col'; index: number } | null>(null);
  const draggingAisleRef = useRef<{ type: 'row' | 'col'; index: number } | null>(null);
  const [pointerDraggingColAisle, setPointerDraggingColAisle] = useState<number | null>(null);
  const [pointerColDropTarget, setPointerColDropTarget] = useState<number | null>(null);
  const restoredClassroomRef = useRef(false);

  const seatKey = (r: number, c: number) => `${r}-${c}`;

  const toggleDisabled = (r: number, c: number) => {
    const key = seatKey(r, c);
    setDisabledSeats(prev => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); }
      else { next.add(key); setSeats(s => { const g = s.map(row => [...row]); if (g[r]) g[r][c] = null; return g; }); }
      return next;
    });
  };

  const isRowFullyDisabled = useCallback((row: number) => {
    for (let c = 0; c < cols; c++) { if (!disabledSeats.has(seatKey(row, c))) return false; }
    return true;
  }, [cols, disabledSeats]);

  const isColFullyDisabled = useCallback((col: number) => {
    for (let r = 0; r < rows; r++) { if (!disabledSeats.has(seatKey(r, col))) return false; }
    return true;
  }, [rows, disabledSeats]);

  const toggleRowDisabled = useCallback((row: number) => {
    const closeAll = !isRowFullyDisabled(row);
    setDisabledSeats(prev => {
      const next = new Set(prev);
      for (let c = 0; c < cols; c++) { const key = seatKey(row, c); if (closeAll) next.add(key); else next.delete(key); }
      return next;
    });
    if (closeAll) { setSeats(prev => { const next = prev.map(r => [...r]); if (next[row]) { for (let c = 0; c < cols; c++) { next[row][c] = null; } } return next; }); }
  }, [cols, isRowFullyDisabled]);

  const toggleColDisabled = useCallback((col: number) => {
    const closeAll = !isColFullyDisabled(col);
    setDisabledSeats(prev => {
      const next = new Set(prev);
      for (let r = 0; r < rows; r++) { const key = seatKey(r, col); if (closeAll) next.add(key); else next.delete(key); }
      return next;
    });
    if (closeAll) { setSeats(prev => { const next = prev.map(r => [...r]); for (let r = 0; r < rows; r++) { if (next[r]) next[r][col] = null; } return next; }); }
  }, [isColFullyDisabled, rows]);

  const makeGrid = (): (string | null)[][] => Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));

  const getCenteredColOrder = useCallback(() => {
    if (cols <= 0) return [] as number[];
    const order: number[] = [];
    if (cols % 2 === 1) {
      const mid = Math.floor(cols / 2);
      order.push(mid);
      let left = mid - 1;
      let right = mid + 1;
      while (left >= 0 || right < cols) {
        if (left >= 0) order.push(left--);
        if (right < cols) order.push(right++);
      }
      return order;
    }

    let left = cols / 2 - 1;
    let right = cols / 2;
    while (left >= 0 || right < cols) {
      if (left >= 0) order.push(left--);
      if (right < cols) order.push(right++);
    }
    return order;
  }, [cols]);

  const getColOrder = useCallback(() => {
    if (startFrom === 'center') return getCenteredColOrder();
    const doorOnRight = windowOnLeft;
    const startFromRight = (startFrom === 'door' && doorOnRight) || (startFrom === 'window' && !doorOnRight);
    if (startFromRight) return Array.from({ length: cols }, (_, i) => cols - 1 - i);
    return Array.from({ length: cols }, (_, i) => i);
  }, [cols, getCenteredColOrder, startFrom, windowOnLeft]);

  const genderStats = useMemo(() => {
    const male = students.filter(s => (s.gender ?? 'unknown') === 'male').length;
    const female = students.filter(s => (s.gender ?? 'unknown') === 'female').length;
    const unknown = students.length - male - female;
    return { male, female, unknown };
  }, [students]);

  const genderByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const student of students) {
      map.set(student.name, student.gender ?? 'unknown');
    }
    return map;
  }, [students]);

  const organizationByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const student of students) {
      map.set(student.name, student.organization?.trim() || '未分单位');
    }
    return map;
  }, [students]);

  const organizationColorMap = useMemo(() => {
    const organizations = Array.from(new Set(students.map(student => student.organization?.trim() || '未分单位')))
      .sort((a, b) => a.localeCompare(b, 'zh-CN'));
    const map = new Map<string, string>();
    organizations.forEach((organization, index) => {
      map.set(organization, ORGANIZATION_COLOR_CLASSES[index % ORGANIZATION_COLOR_CLASSES.length]);
    });
    return map;
  }, [students]);

  const organizationLegend = useMemo(() => {
    return Array.from(organizationColorMap.entries());
  }, [organizationColorMap]);

  const formatSeatLabel = useCallback((name: string | null) => {
    if (!name) return t('seat.empty');
    const gender = genderByName.get(name) ?? 'unknown';
    const marker = gender === 'male' ? '♂️' : gender === 'female' ? '♀️' : '✨';
    const organization = organizationByName.get(name) ?? '未分单位';
    const organizationColorClass = organizationColorMap.get(organization) ?? 'text-foreground';

    if (genderMarkerStyle === 'badge') {
      return (
        <span className={`inline-flex items-center justify-center gap-1 w-full px-0.5 ${organizationColorClass}`} title={organization}>
          <span className="text-[11px] leading-tight whitespace-normal break-all text-center">{name}</span>
          <span className="inline-flex items-center justify-center rounded px-1 py-0.5 text-[10px] leading-none bg-muted border border-border/70 text-muted-foreground">
            {marker}
          </span>
        </span>
      );
    }

    return (
      <span
        className={`${organizationColorClass} block w-full px-0.5 text-center text-[11px] leading-tight whitespace-normal break-all`}
        title={organization}
      >
        {`${name}${marker}`}
      </span>
    );
  }, [genderByName, genderMarkerStyle, organizationByName, organizationColorMap, t]);

  const getGenderMarker = useCallback((name: string) => {
    const gender = genderByName.get(name) ?? 'unknown';
    return gender === 'male' ? '♂️' : gender === 'female' ? '♀️' : '✨';
  }, [genderByName]);

  const getGenderOrderedNames = useCallback(() => {
    if (genderSeatPolicy === 'none') return students.map(s => s.name);

    const male = students.filter(s => (s.gender ?? 'unknown') === 'male').map(s => s.name);
    const female = students.filter(s => (s.gender ?? 'unknown') === 'female').map(s => s.name);
    const unknown = students.filter(s => (s.gender ?? 'unknown') === 'unknown').map(s => s.name);

    if (genderSeatPolicy === 'cluster') {
      return genderFirst === 'male'
        ? [...male, ...female, ...unknown]
        : [...female, ...male, ...unknown];
    }

    const firstBucket = genderFirst === 'male' ? male : female;
    const secondBucket = genderFirst === 'male' ? female : male;
    const alternated: string[] = [];
    let firstIndex = 0;
    let secondIndex = 0;
    let pickFirst = true;

    while (firstIndex < firstBucket.length || secondIndex < secondBucket.length) {
      if (pickFirst && firstIndex < firstBucket.length) {
        alternated.push(firstBucket[firstIndex++]);
      } else if (!pickFirst && secondIndex < secondBucket.length) {
        alternated.push(secondBucket[secondIndex++]);
      } else if (firstIndex < firstBucket.length) {
        alternated.push(firstBucket[firstIndex++]);
      } else if (secondIndex < secondBucket.length) {
        alternated.push(secondBucket[secondIndex++]);
      }
      pickFirst = !pickFirst;
    }

    return [...alternated, ...unknown];
  }, [genderFirst, genderSeatPolicy, students]);

  const autoSeat = useCallback(() => {
    const grid = makeGrid();
    const isAvailable = (r: number, c: number) => !disabledSeats.has(seatKey(r, c));
    const names = getGenderOrderedNames();
    const colOrder = getColOrder();

    const normalizeBuckets = (buckets: string[][]) => {
      const validStudentNames = new Set(students.map(s => s.name));
      const used = new Set<string>();
      return buckets
        .map(bucket => bucket.filter(name => validStudentNames.has(name) && !used.has(name) && (used.add(name), true)))
        .filter(bucket => bucket.length > 0);
    };

    const resolvePersistedBuckets = (source: 'groups' | 'teams') => {
      const rawBuckets = source === 'groups'
        ? loadLastGroups().map(group => group.members.map(member => member.name))
        : loadLastTeams().map(team => team.members.map(member => member.name));
      return normalizeBuckets(rawBuckets);
    };

    const resolveGroupBuckets = () => {
      if (groupSource === 'groups') return resolvePersistedBuckets('groups');
      if (groupSource === 'teams') return resolvePersistedBuckets('teams');
      if (groupSource === 'count') return splitIntoGroups(names, groupCount);

      const fromGroups = resolvePersistedBuckets('groups');
      if (fromGroups.length > 0) return fromGroups;
      const fromTeams = resolvePersistedBuckets('teams');
      if (fromTeams.length > 0) return fromTeams;
      return splitIntoGroups(names, groupCount);
    };

    const getCenteredCols = (availableCols: number[], count: number) => {
      if (count >= availableCols.length) return availableCols;
      const sorted = [...availableCols].sort((a, b) => a - b);
      const start = Math.floor((sorted.length - count) / 2);
      return sorted.slice(start, start + count);
    };

    if (genderSeatPolicy === 'alternateRows') {
      const maleQueue = students.filter(s => (s.gender ?? 'unknown') === 'male').map(s => s.name);
      const femaleQueue = students.filter(s => (s.gender ?? 'unknown') === 'female').map(s => s.name);
      const unknownQueue = students.filter(s => (s.gender ?? 'unknown') === 'unknown').map(s => s.name);

      const takeFromQueue = (queue: string[], count: number) => {
        if (count <= 0) return [] as string[];
        return queue.splice(0, count);
      };

      for (let r = 0; r < rows; r++) {
        const rowAvailableCols = colOrder.filter(c => isAvailable(r, c));
        if (rowAvailableCols.length === 0) continue;

        const useMaleFirst = genderFirst === 'male';
        const primaryQueue = (r % 2 === 0)
          ? (useMaleFirst ? maleQueue : femaleQueue)
          : (useMaleFirst ? femaleQueue : maleQueue);
        const secondaryQueue = (r % 2 === 0)
          ? (useMaleFirst ? femaleQueue : maleQueue)
          : (useMaleFirst ? maleQueue : femaleQueue);

        const rowNames: string[] = [];
        const primarySlice = takeFromQueue(primaryQueue, rowAvailableCols.length);
        rowNames.push(...primarySlice);

        // Keep "alternate rows" visually clear: only backfill with another gender when primary queue is empty.
        if (primarySlice.length === 0 && rowNames.length < rowAvailableCols.length) {
          rowNames.push(...takeFromQueue(secondaryQueue, rowAvailableCols.length - rowNames.length));
        }
        if (rowNames.length < rowAvailableCols.length) {
          rowNames.push(...takeFromQueue(unknownQueue, rowAvailableCols.length - rowNames.length));
        }

        if (rowNames.length === 0) continue;
        const targetCols = centerRowsByGender
          ? getCenteredCols(rowAvailableCols, rowNames.length)
          : rowAvailableCols.slice(0, rowNames.length);

        for (let i = 0; i < rowNames.length; i++) {
          const c = targetCols[i];
          if (c !== undefined) grid[r][c] = rowNames[i];
        }
      }

      setSeats(grid);
      return;
    }

    switch (mode) {
      case 'verticalS': { let idx = 0; for (let ci = 0; ci < cols && idx < names.length; ci++) { const c = colOrder[ci]; for (let r = 0; r < rows && idx < names.length; r++) { const row = ci % 2 === 0 ? r : rows - 1 - r; if (isAvailable(row, c)) grid[row][c] = names[idx++]; } } break; }
      case 'horizontalS': { let idx = 0; for (let r = 0; r < rows && idx < names.length; r++) { for (let ci = 0; ci < cols && idx < names.length; ci++) { const rawCol = r % 2 === 0 ? ci : cols - 1 - ci; const c = colOrder[rawCol]; if (isAvailable(r, c)) grid[r][c] = names[idx++]; } } break; }
      case 'exam': { let idx = 0; for (let ci = 0; ci < cols && idx < names.length; ci++) { const c = colOrder[ci]; if (examSkipCol && ci % 2 !== 0) continue; for (let r = 0; r < rows && idx < names.length; r++) { const row = ci % 2 === 0 ? r : rows - 1 - r; if (examSkipRow && row % 2 !== 0) continue; if (isAvailable(row, c)) grid[row][c] = names[idx++]; } } break; }
      case 'groupCol': { const groups = resolveGroupBuckets(); groups.forEach((group, gi) => { const colIdx = gi % cols; const c = colOrder[colIdx]; const baseRow = Math.floor(gi / cols) * Math.ceil(names.length / Math.max(1, groups.length)); let placed = 0; for (let r = 0; r < rows && placed < group.length; r++) { const row = r + baseRow; if (row < rows && isAvailable(row, c)) grid[row][c] = group[placed++]; } }); break; }
      case 'groupRow': { const groups = resolveGroupBuckets(); groups.forEach((group, gi) => { const row = gi % rows; const baseShift = Math.floor(gi / rows) * Math.ceil(names.length / Math.max(1, groups.length)); let placed = 0; for (let ci = 0; ci < cols && placed < group.length; ci++) { const c = colOrder[ci]; const colShift = ci + baseShift; if (row < rows && colShift < cols && isAvailable(row, c)) grid[row][c] = group[placed++]; } }); break; }
      case 'smartCluster': {
        if (smartClusterStrategy === 'orgFrontWeighted') {
          const orgByName = new Map(students.map(student => [student.name, (student.organization?.trim() || '未分单位')]));
          const orgQueues = new Map<string, string[]>();
          for (const name of names) {
            const org = orgByName.get(name) ?? '未分单位';
            const queue = orgQueues.get(org) ?? [];
            queue.push(name);
            orgQueues.set(org, queue);
          }

          const orgEntries = Array.from(orgQueues.entries())
            .filter(([, queue]) => queue.length > 0)
            .sort((a, b) => b[1].length - a[1].length);

          if (orgEntries.length === 0) break;

          const organizationCount = orgEntries.length;
          const totalCols = cols;
          const totalStudentsCount = orgEntries.reduce((sum, [, queue]) => sum + queue.length, 0);

          const quotas = orgEntries.map(([, queue]) => (queue.length / Math.max(1, totalStudentsCount)) * totalCols);
          const allocations = quotas.map(value => Math.floor(value));

          if (organizationCount <= totalCols) {
            for (let i = 0; i < allocations.length; i++) {
              if (allocations[i] === 0) allocations[i] = 1;
            }
          } else {
            for (let i = 0; i < allocations.length; i++) allocations[i] = 0;
            for (let i = 0; i < totalCols; i++) allocations[i] = 1;
          }

          let allocatedCols = allocations.reduce((sum, value) => sum + value, 0);
          if (allocatedCols < totalCols) {
            const remainders = quotas
              .map((value, index) => ({ index, remainder: value - allocations[index] }))
              .sort((a, b) => b.remainder - a.remainder);
            let cursor = 0;
            while (allocatedCols < totalCols && remainders.length > 0) {
              const target = remainders[cursor % remainders.length];
              allocations[target.index] += 1;
              allocatedCols += 1;
              cursor += 1;
            }
          } else if (allocatedCols > totalCols) {
            const reducible = quotas
              .map((value, index) => ({ index, remainder: value - allocations[index] }))
              .sort((a, b) => a.remainder - b.remainder);
            let cursor = 0;
            while (allocatedCols > totalCols && reducible.length > 0) {
              const target = reducible[cursor % reducible.length];
              const minKeep = organizationCount <= totalCols ? 1 : 0;
              if (allocations[target.index] > minKeep) {
                allocations[target.index] -= 1;
                allocatedCols -= 1;
              }
              cursor += 1;
              if (cursor > reducible.length * Math.max(2, totalCols)) break;
            }
          }

          const orgCols = new Map<string, number[]>();
          let colCursor = 0;
          for (let i = 0; i < orgEntries.length; i++) {
            const [org] = orgEntries[i];
            const count = allocations[i];
            const colsForOrg: number[] = [];
            for (let k = 0; k < count && colCursor < colOrder.length; k++) {
              colsForOrg.push(colOrder[colCursor]);
              colCursor += 1;
            }
            if (colsForOrg.length > 0) orgCols.set(org, colsForOrg);
          }

          for (let r = 0; r < rows; r++) {
            for (const [org] of orgEntries) {
              const queue = orgQueues.get(org);
              const colsForOrg = orgCols.get(org);
              if (!queue || queue.length === 0 || !colsForOrg || colsForOrg.length === 0) continue;
              for (const c of colsForOrg) {
                if (queue.length === 0) break;
                if (!isAvailable(r, c) || grid[r][c]) continue;
                const nextName = queue.shift();
                if (nextName) grid[r][c] = nextName;
              }
            }
          }

          const leftovers: string[] = [];
          for (const [, queue] of orgEntries) {
            while (queue.length > 0) {
              const nextName = queue.shift();
              if (nextName) leftovers.push(nextName);
            }
          }

          let leftoverIndex = 0;
          for (let r = 0; r < rows && leftoverIndex < leftovers.length; r++) {
            for (const c of colOrder) {
              if (leftoverIndex >= leftovers.length) break;
              if (!isAvailable(r, c) || grid[r][c]) continue;
              grid[r][c] = leftovers[leftoverIndex++];
            }
          }
          break;
        }

        const groups = resolveGroupBuckets();
        const clusterCount = Math.max(1, groups.length);
        const blocksPerRow = Math.ceil(Math.sqrt(clusterCount));
        const blockRows = Math.ceil(clusterCount / blocksPerRow);
        const blockH = Math.max(1, Math.floor(rows / blockRows));
        const blockW = Math.max(1, Math.floor(cols / blocksPerRow));
        groups.forEach((group, gi) => {
          const bRow = Math.floor(gi / blocksPerRow);
          const bCol = gi % blocksPerRow;
          const startR = bRow * blockH;
          const startC = bCol * blockW;
          let placed = 0;
          for (let mi = 0; placed < group.length; mi++) {
            const lr = mi % blockH;
            const lc = Math.floor(mi / blockH);
            const r = startR + lr;
            const c = startC + lc;
            if (r >= rows || c >= cols) break;
            if (isAvailable(r, c)) grid[r][c] = group[placed++];
          }
        });
        break;
      }
      case 'random': { const shuffled = [...names].sort(() => Math.random() - 0.5); let idx = 0; for (let r = 0; r < rows && idx < shuffled.length; r++) { for (let c = 0; c < cols && idx < shuffled.length; c++) { if (isAvailable(r, c)) grid[r][c] = shuffled[idx++]; } } break; }
    }
    setSeats(grid);
  }, [rows, cols, mode, groupCount, groupSource, smartClusterStrategy, disabledSeats, examSkipRow, examSkipCol, getColOrder, getGenderOrderedNames, genderSeatPolicy, students, genderFirst, centerRowsByGender]);

  const handleDragStart = (r: number, c: number) => { if (!seats[r][c]) return; setDragFrom({ r, c }); };
  const handleDragOver = (e: React.DragEvent, r: number, c: number) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropTarget({ r, c }); };
  const handleDrop = (e: React.DragEvent, r: number, c: number) => {
    e.preventDefault(); if (!dragFrom) return;
    setSeats(prev => { const next = prev.map(row => [...row]); const temp = next[r][c]; next[r][c] = next[dragFrom.r][dragFrom.c]; next[dragFrom.r][dragFrom.c] = temp; return next; });
    setDragFrom(null); setDropTarget(null);
  };
  const handleDragEnd = () => { setDragFrom(null); setDropTarget(null); };

  const addColAisle = () => { const mid = Math.floor(cols / 2) - 1; const candidate = colAisles.includes(mid) ? findNextFree(mid, cols - 1, colAisles) : mid; if (candidate !== null) setColAisles(prev => [...prev, candidate].sort((a, b) => a - b)); };
  const addRowAisle = () => { const mid = Math.floor(rows / 2) - 1; const candidate = rowAisles.includes(mid) ? findNextFree(mid, rows - 1, rowAisles) : mid; if (candidate !== null) setRowAisles(prev => [...prev, candidate].sort((a, b) => a - b)); };
  const removeColAisle = (idx: number) => { setColAisles(prev => prev.filter(a => a !== idx)); };
  const removeRowAisle = (idx: number) => { setRowAisles(prev => prev.filter(a => a !== idx)); };

  const moveAisle = useCallback((type: 'row' | 'col', oldIndex: number, newIndex: number) => {
    if (oldIndex === newIndex) return;
    if (type === 'col') { setColAisles(prev => { const next = prev.filter(a => a !== oldIndex); if (!next.includes(newIndex)) next.push(newIndex); return next.sort((a, b) => a - b); }); return; }
    setRowAisles(prev => { const next = prev.filter(a => a !== oldIndex); if (!next.includes(newIndex)) next.push(newIndex); return next.sort((a, b) => a - b); });
  }, []);

  const pendingColAisleRef = useRef<number | null>(null);
  const pointerStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const clearPointerColAisleDrag = useCallback(() => { pendingColAisleRef.current = null; pointerStartPosRef.current = null; setPointerDraggingColAisle(null); setPointerColDropTarget(null); draggingAisleRef.current = null; setDraggingAisle(null); }, []);
  const activateColAislePointerDrag = useCallback((index: number) => { pendingColAisleRef.current = null; const payload = { type: 'col' as const, index }; draggingAisleRef.current = payload; setDraggingAisle(payload); setPointerDraggingColAisle(index); setPointerColDropTarget(index); }, []);
  const startColAislePointerDrag = (e: React.MouseEvent, index: number) => { e.preventDefault(); e.stopPropagation(); pendingColAisleRef.current = index; pointerStartPosRef.current = { x: e.clientX, y: e.clientY }; };
  const handleColAisleDoubleClick = (e: React.MouseEvent, aisleIndex: number) => { e.preventDefault(); e.stopPropagation(); pendingColAisleRef.current = null; pointerStartPosRef.current = null; clearPointerColAisleDrag(); removeColAisle(aisleIndex); };

  const finishColAislePointerDrag = useCallback((targetIndex?: number | null) => {
    if (pointerDraggingColAisle === null) { clearPointerColAisleDrag(); return; }
    const resolvedTarget = targetIndex ?? pointerColDropTarget;
    if (resolvedTarget !== null && resolvedTarget !== undefined) moveAisle('col', pointerDraggingColAisle, resolvedTarget);
    clearPointerColAisleDrag();
  }, [clearPointerColAisleDrag, moveAisle, pointerColDropTarget, pointerDraggingColAisle]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (pendingColAisleRef.current !== null && pointerStartPosRef.current && pointerDraggingColAisle === null) {
        const dx = Math.abs(e.clientX - pointerStartPosRef.current.x); const dy = Math.abs(e.clientY - pointerStartPosRef.current.y);
        if (dx > 4 || dy > 4) activateColAislePointerDrag(pendingColAisleRef.current);
      }
    };
    const handleMouseUp = () => { if (pendingColAisleRef.current !== null && pointerDraggingColAisle === null) { pendingColAisleRef.current = null; pointerStartPosRef.current = null; return; } if (pointerDraggingColAisle !== null) finishColAislePointerDrag(); };
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') clearPointerColAisleDrag(); };
    window.addEventListener('mousemove', handleMouseMove); window.addEventListener('mouseup', handleMouseUp); window.addEventListener('keydown', handleKeyDown);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); window.removeEventListener('keydown', handleKeyDown); };
  }, [activateColAislePointerDrag, clearPointerColAisleDrag, finishColAislePointerDrag, pointerDraggingColAisle]);

  const handleAisleDragStart = (e: React.DragEvent, type: 'row' | 'col', index: number) => { e.stopPropagation(); const payload = { type, index }; draggingAisleRef.current = payload; setDraggingAisle(payload); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', `${type}:${index}`); };
  const handleAisleDragOver = (e: React.DragEvent) => { if (draggingAisle || draggingAisleRef.current) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } };
  const handleAisleDropOnGap = (e: React.DragEvent, type: 'row' | 'col', newIndex: number) => {
    e.preventDefault(); e.stopPropagation();
    let current = draggingAisle ?? draggingAisleRef.current;
    if (!current) { const raw = e.dataTransfer.getData('text/plain'); const [dragType, dragIndex] = raw.split(':'); if ((dragType === 'row' || dragType === 'col') && dragIndex !== undefined) current = { type: dragType, index: Number(dragIndex) }; }
    if (!current || current.type !== type || Number.isNaN(current.index)) return;
    moveAisle(type, current.index, newIndex);
    draggingAisleRef.current = null; setDraggingAisle(null);
    if (type === 'col') { setPointerDraggingColAisle(null); setPointerColDropTarget(null); }
  };
  const handleAisleDragEnd = () => { setTimeout(() => { draggingAisleRef.current = null; setDraggingAisle(null); setPointerDraggingColAisle(null); setPointerColDropTarget(null); }, 0); };

  const needsGroupCount = ['groupCol', 'groupRow', 'smartCluster'].includes(mode);
  const isExamMode = mode === 'exam';
  const printRef = useRef<HTMLDivElement>(null);
  const exportSceneConfig = { rows, cols, windowOnLeft, colAisles, rowAisles, entryDoorMode, frontDoorPosition, backDoorPosition };
  const { className: exportClassName, resolveQrCode, handleSessionCreated } = useSeatExportQr({
    seatData: seats,
    studentNames: students.map(s => s.name),
    seatAssignmentReady: seats.length > 0,
    sceneConfig: exportSceneConfig,
    sceneType: 'classroom',
  });
  const sideIconClass = 'inline-flex items-center justify-center w-8 h-8 rounded-lg border border-primary/30 bg-primary/10 text-base leading-none shadow-sm';
  const sideMarkerIconClass = 'inline-flex items-center justify-center w-6 h-6 rounded-md border border-primary/30 bg-primary/10 text-sm leading-none';

  const sanitizeClassroomSeats = (rawSeats: (string | null)[][], nextRows: number, nextCols: number) => {
    const validStudentNames = new Set(students.map(s => s.name));
    return Array.from({ length: nextRows }, (_, r) =>
      Array.from({ length: nextCols }, (_, c) => {
        const name = rawSeats?.[r]?.[c];
        if (!name) return null;
        return validStudentNames.has(name) ? name : null;
      })
    );
  };

  const normalizeClassroomDimension = (value: number) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 2;
    return Math.max(2, Math.floor(parsed));
  };

  const buildClassroomSnapshot = () => ({
    rows,
    cols,
    mode,
    groupCount,
    groupSource,
    smartClusterStrategy,
    disabledSeats: Array.from(disabledSeats),
    examSkipRow,
    examSkipCol,
    startFrom,
    windowOnLeft,
    colAisles,
    rowAisles,
    seats,
    updatedAt: new Date().toISOString(),
  });

  const saveClassroomToHistory = () => {
    if (seats.length === 0) {
      toast.error('请先完成排座再保存');
      return;
    }
    const name = recordName.trim() || `教室-${new Date().toLocaleString()}`;
    const item = saveClassroomHistory(name, buildClassroomSnapshot());
    const nextItems = [item, ...historyItems].slice(0, 50);
    setHistoryItems(nextItems);
    setSelectedHistoryId(item.id);
    setRecordName(name);
    saveClassroomSnapshot(item.snapshot);
    toast.success('已保存到历史记录');
  };

  const restoreClassroomFromHistory = () => {
    const item = historyItems.find(history => history.id === selectedHistoryId);
    if (!item) {
      toast.error('请选择要恢复的历史记录');
      return;
    }
    const snapshot = item.snapshot;
    const nextRows = normalizeClassroomDimension(snapshot.rows);
    const nextCols = normalizeClassroomDimension(snapshot.cols);
    const nextSeats = sanitizeClassroomSeats(snapshot.seats || [], nextRows, nextCols);

    setRows(nextRows);
    setCols(nextCols);
    setMode(snapshot.mode);
    setGroupCount(Math.max(2, Math.min(10, snapshot.groupCount)));
    setGroupSource(snapshot.groupSource ?? 'auto');
    setExamSkipRow(!!snapshot.examSkipRow);
    setExamSkipCol(!!snapshot.examSkipCol);
    setStartFrom(snapshot.startFrom === 'center' ? 'center' : snapshot.startFrom);
    setSmartClusterStrategy(snapshot.smartClusterStrategy ?? 'orgFrontWeighted');
    setWindowOnLeft(!!snapshot.windowOnLeft);
    setColAisles((snapshot.colAisles || []).filter(a => a >= 0 && a < nextCols - 1));
    setRowAisles((snapshot.rowAisles || []).filter(a => a >= 0 && a < nextRows - 1));
    setDisabledSeats(new Set((snapshot.disabledSeats || []).filter(key => {
      const [r, c] = key.split('-').map(Number);
      return Number.isFinite(r) && Number.isFinite(c) && r >= 0 && r < nextRows && c >= 0 && c < nextCols;
    })));
    setSeats(nextSeats);
    setRecordName(item.name);

    saveClassroomSnapshot({
      ...snapshot,
      rows: nextRows,
      cols: nextCols,
      seats: nextSeats,
    });
    toast.success('已从历史记录恢复，可继续调整');
  };

  useEffect(() => {
    setHistoryItems(loadClassroomHistory());
  }, []);

  useEffect(() => {
    if (restoredClassroomRef.current) return;
    const snapshot = loadClassroomSnapshot();
    if (!snapshot) {
      restoredClassroomRef.current = true;
      return;
    }

    const nextRows = normalizeClassroomDimension(snapshot.rows);
    const nextCols = normalizeClassroomDimension(snapshot.cols);
    const nextSeats = sanitizeClassroomSeats(snapshot.seats || [], nextRows, nextCols);

    setRows(nextRows);
    setCols(nextCols);
    setMode(snapshot.mode);
    setGroupCount(Math.max(2, Math.min(10, snapshot.groupCount)));
    setGroupSource(snapshot.groupSource ?? 'auto');
    setExamSkipRow(!!snapshot.examSkipRow);
    setExamSkipCol(!!snapshot.examSkipCol);
    setStartFrom(snapshot.startFrom === 'center' ? 'center' : snapshot.startFrom);
    setSmartClusterStrategy(snapshot.smartClusterStrategy ?? 'orgFrontWeighted');
    setWindowOnLeft(!!snapshot.windowOnLeft);
    setColAisles((snapshot.colAisles || []).filter(a => a >= 0 && a < nextCols - 1));
    setRowAisles((snapshot.rowAisles || []).filter(a => a >= 0 && a < nextRows - 1));
    setDisabledSeats(new Set((snapshot.disabledSeats || []).filter(key => {
      const [r, c] = key.split('-').map(Number);
      return Number.isFinite(r) && Number.isFinite(c) && r >= 0 && r < nextRows && c >= 0 && c < nextCols;
    })));
    setSeats(nextSeats);
    restoredClassroomRef.current = true;
  }, [students]);

  useEffect(() => {
    if (!restoredClassroomRef.current) return;
    saveClassroomSnapshot(buildClassroomSnapshot());
  }, [rows, cols, mode, groupCount, groupSource, smartClusterStrategy, disabledSeats, examSkipRow, examSkipCol, startFrom, windowOnLeft, colAisles, rowAisles, seats]);

  const buildVisualGrid = () => {
    if (seats.length === 0) return null;
    const elements: React.ReactNode[] = [];
    const totalVisualCols = cols + colAisles.length;
    const doorOnRight = windowOnLeft;
    const seatAreaStartCol = doorOnRight ? 1 : 2;
    const rowLabelCol = doorOnRight ? totalVisualCols + 1 : 1;
    const seatAreaStartRow = 2;

    const realToVisualCol = (realCol: number) => { let offset = 0; for (const a of colAisles) { if (realCol > a) offset++; } return realCol + offset; };
    const toGridCol = (visualCol: number) => seatAreaStartCol + visualCol;

    for (let ci = 0; ci < cols; ci++) {
      const visualCol = realToVisualCol(ci);
      const displayCol = doorOnRight ? cols - ci : ci + 1;
      const colDisabled = isColFullyDisabled(ci);
      elements.push(
        <div key={`col-label-${ci}`} style={{ gridRow: 1, gridColumn: toGridCol(visualCol) }} className="w-16 h-12 flex items-center justify-center">
          <button type="button" onClick={() => toggleColDisabled(ci)}
            className={`h-5 px-2 rounded-full text-[10px] leading-none whitespace-nowrap select-none border shadow-sm transition-colors ${colDisabled ? 'bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/20' : 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/15'}`}
            title={colDisabled ? t('seat.enableCol') : t('seat.disableCol')}
          >
            {t('seat.colLabel').replace('{0}', String(displayCol))}
          </button>
        </div>
      );
    }

    for (let ri = 0; ri < rows; ri++) {
      for (let ci = 0; ci < cols; ci++) {
        const visualCol = realToVisualCol(ci);
        const name = seats[ri]?.[ci] ?? null;
        const isDragging = dragFrom?.r === ri && dragFrom?.c === ci;
        const isOver = dropTarget?.r === ri && dropTarget?.c === ci;
        const isDisabled = disabledSeats.has(seatKey(ri, ci));

        elements.push(
          <div key={`seat-${ri}-${ci}`} draggable={!!name && !isDisabled}
            onDragStart={() => handleDragStart(ri, ci)}
            onDragOver={e => { if (isDisabled) return; const raw = e.dataTransfer.getData('text/plain'); const isAisleDrag = !!draggingAisle || !!draggingAisleRef.current || raw.startsWith('col:') || raw.startsWith('row:'); if (isAisleDrag) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; return; } handleDragOver(e, ri, ci); }}
            onDrop={e => { if (isDisabled) return; const raw = e.dataTransfer.getData('text/plain'); const [dragType, dragIndex] = raw.split(':'); const parsedIndex = Number(dragIndex); const currentAisle = draggingAisle ?? draggingAisleRef.current; const isColAisleDrag = currentAisle?.type === 'col' || (dragType === 'col' && Number.isFinite(parsedIndex)); const isAnyAisleDrag = !!currentAisle || dragType === 'col' || dragType === 'row'; if (isColAisleDrag) { const targetIndex = Math.min(ci, cols - 2); handleAisleDropOnGap(e, 'col', targetIndex); return; } if (isAnyAisleDrag) { e.preventDefault(); return; } handleDrop(e, ri, ci); }}
            onDragEnd={handleDragEnd}
            onClick={() => !name && toggleDisabled(ri, ci)}
            style={{ gridRow: getVisualRow(ri, rowAisles) + seatAreaStartRow, gridColumn: toGridCol(visualCol) }}
            className={`w-16 h-12 rounded-lg border text-xs flex items-center justify-center transition-all select-none
              ${isDisabled ? 'bg-destructive/10 border-destructive/30 text-destructive cursor-pointer'
                : name ? `bg-card border-border text-foreground shadow-card cursor-grab active:cursor-grabbing hover:border-primary/40 ${isDragging ? 'opacity-30 scale-90' : ''} ${isOver ? 'ring-2 ring-primary/40 border-primary/40 scale-105' : ''}`
                : `bg-muted/50 border-dashed border-border text-muted-foreground cursor-pointer hover:border-destructive/40 ${isOver && dragFrom ? 'ring-2 ring-primary/30 border-primary/30' : ''}`}`}
          >
            {isDisabled ? <X className="w-4 h-4" /> : formatSeatLabel(name)}
          </div>
        );
      }

      const rowDisabled = isRowFullyDisabled(ri);
      elements.push(
        <div key={`row-label-${ri}`} style={{ gridRow: getVisualRow(ri, rowAisles) + seatAreaStartRow, gridColumn: rowLabelCol }} className="w-16 h-12 flex items-center justify-center">
          <button type="button" onClick={() => toggleRowDisabled(ri)}
            className={`h-5 px-2 rounded-full text-[10px] leading-none whitespace-nowrap select-none border shadow-sm transition-colors ${rowDisabled ? 'bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/20' : 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/15'}`}
            title={rowDisabled ? t('seat.enableRow') : t('seat.disableRow')}
          >
            {t('seat.rowLabel').replace('{0}', String(ri + 1))}
          </button>
        </div>
      );

      for (const aisleAfterCol of colAisles) {
        const visualCol = aisleAfterCol + colAisles.filter(a => a < aisleAfterCol).length + 1;
        const isPointerDraggingThis = pointerDraggingColAisle === aisleAfterCol;
        elements.push(
          <div key={`col-aisle-${ri}-${aisleAfterCol}`} onMouseDown={e => startColAislePointerDrag(e, aisleAfterCol)}
            style={{ gridRow: getVisualRow(ri, rowAisles) + seatAreaStartRow, gridColumn: toGridCol(visualCol) }}
            className={`w-16 h-12 flex items-center justify-center transition-colors ${isPointerDraggingThis ? 'cursor-grabbing' : 'cursor-grab'} group`}
            title={t('seat.dragAisle')} onDoubleClick={e => handleColAisleDoubleClick(e, aisleAfterCol)}>
            <div className={`w-0.5 h-8 rounded transition-colors ${isPointerDraggingThis ? 'bg-primary' : 'bg-border group-hover:bg-primary/40'}`} />
          </div>
        );
      }

      if (rowAisles.includes(ri)) {
        const aisleVisualRow = getVisualRow(ri, rowAisles) + seatAreaStartRow + 1;
        for (let ci = 0; ci < totalVisualCols; ci++) {
          elements.push(
            <div key={`row-aisle-${ri}-${ci}`} draggable={ci === 0}
              onDragStart={ci === 0 ? (e => handleAisleDragStart(e, 'row', ri)) : undefined}
              onDragEnd={ci === 0 ? handleAisleDragEnd : undefined}
              style={{ gridRow: aisleVisualRow, gridColumn: toGridCol(ci) }}
              className={`w-16 h-12 flex items-center justify-center ${ci === 0 ? 'cursor-grab active:cursor-grabbing' : ''} group`}
              title={ci === 0 ? t('seat.dragAisleRow') : undefined}
              onDoubleClick={ci === 0 ? () => removeRowAisle(ri) : undefined}>
              <div className="w-8 h-0.5 bg-border group-hover:bg-primary/40 rounded transition-colors" />
            </div>
          );
        }
      }
    }

    if (draggingAisle?.type === 'col') {
      for (let ci = 0; ci < cols - 1; ci++) {
        if (colAisles.includes(ci) && ci !== draggingAisle.index) continue;
        const visualCol = realToVisualCol(ci);
        const isPointerTarget = pointerDraggingColAisle !== null && pointerColDropTarget === ci;
        elements.push(
          <div key={`col-drop-${ci}`} onDragOver={handleAisleDragOver} onDrop={e => handleAisleDropOnGap(e, 'col', ci)}
            onMouseEnter={() => { if (pointerDraggingColAisle !== null) setPointerColDropTarget(ci); }}
            onMouseUp={e => { if (pointerDraggingColAisle === null) return; e.preventDefault(); finishColAislePointerDrag(ci); }}
            style={{ gridRow: `${seatAreaStartRow} / -1`, gridColumn: toGridCol(colAisles.includes(ci) ? visualCol + 1 : visualCol), pointerEvents: 'all' }}
            className={`w-16 z-10 relative ${isPointerTarget ? 'bg-primary/20 border-2 border-dashed border-primary/60 rounded-lg' : ci === draggingAisle.index ? '' : 'bg-primary/10 border-2 border-dashed border-primary/30 rounded-lg'}`}
          />
        );
      }
    }

    if (draggingAisle?.type === 'row') {
      for (let ri = 0; ri < rows - 1; ri++) {
        if (rowAisles.includes(ri) && ri !== draggingAisle.index) continue;
        const visualRow = getVisualRow(ri, rowAisles);
        elements.push(
          <div key={`row-drop-${ri}`} onDragOver={handleAisleDragOver} onDrop={e => handleAisleDropOnGap(e, 'row', ri)}
            style={{ gridRow: visualRow + seatAreaStartRow, gridColumn: `${seatAreaStartCol} / ${seatAreaStartCol + totalVisualCols}`, pointerEvents: 'all' }}
            className={`h-12 z-10 relative ${ri === draggingAisle.index ? '' : 'bg-primary/10 border-2 border-dashed border-primary/30 rounded-lg'}`}
          />
        );
      }
    }

    const totalVisualRows = rows + rowAisles.length + 1;

    return (
      <div className="inline-grid gap-1.5 relative shrink-0"
        style={{ gridTemplateColumns: `repeat(${totalVisualCols + 1}, 4rem)`, gridTemplateRows: `repeat(${totalVisualRows}, 3rem)` }}>
        {elements}
      </div>
    );
  };

  return (
    <div data-testid="seat-chart-panel" className="flex-1 p-4 sm:p-8 pb-[max(1rem,env(safe-area-inset-bottom))] overflow-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap gap-2 mb-5 pb-1">
          {SCENES.map(s => (
            <button key={s.id} onClick={() => setScene(s.id)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border ${scene === s.id ? 'bg-primary text-primary-foreground border-primary shadow-soft' : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted'}`}
              title={s.desc}>{s.label}</button>
          ))}
        </div>

        {scene === 'smartClassroom' && (
          <SmartClassroom
            students={students}
            frontDoorPosition={frontDoorPosition}
            backDoorPosition={backDoorPosition}
            entryDoorMode={entryDoorMode}
          />
        )}
                {/* 学生入场门选择 */}
                <div className="flex flex-wrap gap-2 mb-2 items-center">
                  <label className="flex items-center gap-1 text-sm">
                    学生入场门：
                    <select
                      value={entryDoorMode}
                      onChange={e => setEntryDoorMode(e.target.value as EntryDoorMode)}
                      className="h-8 px-2 rounded-md border border-input bg-background text-foreground text-sm"
                    >
                      <option value="front">仅前门</option>
                      <option value="back">仅后门</option>
                      <option value="both">前后门都可</option>
                    </select>
                  </label>
                </div>
        {scene === 'conference' && <ConferenceRoom students={students} />}
        {scene === 'concertHall' && <ConcertHall students={students} />}
        {scene === 'banquet' && <BanquetHall students={students} />}
        {scene === 'computerLab' && <ComputerLab students={students} />}
        {scene === 'artStudio' && <ArtStudio students={students} />}

        {scene === 'classroom' && (<>
        {/* 前门/后门位置设置 */}
        <div className="flex flex-wrap gap-2 mb-2 items-center">
          <label className="flex items-center gap-1 text-sm">
            前门位置：
            <select
              value={frontDoorPosition}
              onChange={e => setFrontDoorPosition(e.target.value as DoorPosition)}
              className="h-8 px-2 rounded-md border border-input bg-background text-foreground text-sm"
            >
              <option value="top">上方</option>
              <option value="bottom">下方</option>
              <option value="left">左侧</option>
              <option value="right">右侧</option>
            </select>
          </label>
          <label className="flex items-center gap-1 text-sm">
            后门位置：
            <select
              value={backDoorPosition}
              onChange={e => setBackDoorPosition(e.target.value as DoorPosition)}
              className="h-8 px-2 rounded-md border border-input bg-background text-foreground text-sm"
            >
              <option value="top">上方</option>
              <option value="bottom">下方</option>
              <option value="left">左侧</option>
              <option value="right">右侧</option>
            </select>
          </label>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-foreground">{t('seat.title')}</h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">{t('seat.subtitle')}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              {t('seat.rows')}
              <Input type="number" min={2} value={rows} onChange={e => setRows(normalizeClassroomDimension(Number(e.target.value)))} className="w-14 h-8 text-center" />
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              {t('seat.cols')}
              <Input type="number" min={2} value={cols} onChange={e => setCols(normalizeClassroomDimension(Number(e.target.value)))} className="w-14 h-8 text-center" />
            </label>
            {needsGroupCount && (
              <>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  分组来源
                  <select
                    value={groupSource}
                    onChange={e => setGroupSource(e.target.value as SeatGroupSource)}
                    className="h-8 px-2 rounded-md border border-input bg-background text-foreground text-sm"
                  >
                    <option value="auto">自动（优先分组，其次建队）</option>
                    <option value="groups">已分组结果</option>
                    <option value="teams">已建队结果</option>
                    <option value="count">按组数临时分组</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  {t('seat.groups')}
                  <Input type="number" min={2} max={10} value={groupCount} onChange={e => setGroupCount(Math.max(2, Math.min(10, Number(e.target.value))))} className="w-14 h-8 text-center" />
                </label>
              </>
            )}
            {isExamMode && (
              <>
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={examSkipRow} onChange={e => setExamSkipRow(e.target.checked)} className="accent-primary" />
                  {t('seat.skipRow')}
                </label>
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={examSkipCol} onChange={e => setExamSkipCol(e.target.checked)} className="accent-primary" />
                  {t('seat.skipCol')}
                </label>
              </>
            )}
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              {t('seat.startFrom')}
              <select value={startFrom} onChange={e => setStartFrom(e.target.value as StartFrom)} className="h-8 px-2 rounded-md border border-input bg-background text-foreground text-sm">
                <option value="door">{t('seat.fromDoor')}</option>
                <option value="window">{t('seat.fromWindow')}</option>
                <option value="center">居中开始</option>
              </select>
            </label>
            {mode === 'smartCluster' && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                智慧集中策略
                <select
                  value={smartClusterStrategy}
                  onChange={e => setSmartClusterStrategy(e.target.value as SmartClusterStrategy)}
                  className="h-8 px-2 rounded-md border border-input bg-background text-foreground text-sm"
                >
                  <option value="orgFrontWeighted">策略1：前排优先 + 按单位人数分列</option>
                  <option value="classic">经典聚类</option>
                </select>
              </label>
            )}
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              性别排座
              <select
                value={genderSeatPolicy}
                onChange={e => setGenderSeatPolicy(e.target.value as GenderSeatPolicy)}
                className="h-8 px-2 rounded-md border border-input bg-background text-foreground text-sm"
              >
                <option value="none">不限制</option>
                <option value="alternate">男女间隔</option>
                <option value="cluster">男女集中</option>
                <option value="alternateRows">男女隔行</option>
              </select>
            </label>
            {genderSeatPolicy !== 'none' && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                起始性别
                <select
                  value={genderFirst}
                  onChange={e => setGenderFirst(e.target.value as GenderFirst)}
                  className="h-8 px-2 rounded-md border border-input bg-background text-foreground text-sm"
                >
                  <option value="male">男生在前</option>
                  <option value="female">女生在前</option>
                </select>
              </label>
            )}
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              性别标识
              <select
                value={genderMarkerStyle}
                onChange={e => setGenderMarkerStyle(e.target.value as GenderMarkerStyle)}
                className="h-8 px-2 rounded-md border border-input bg-background text-foreground text-sm"
              >
                <option value="suffix">后缀样式</option>
                <option value="badge">徽章样式</option>
              </select>
            </label>
            {genderSeatPolicy === 'alternateRows' && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={centerRowsByGender}
                  onChange={e => setCenterRowsByGender(e.target.checked)}
                  className="accent-primary"
                />
                居中排列
              </label>
            )}
            {genderSeatPolicy !== 'none' && (
              <div className="text-xs text-muted-foreground rounded-md border border-border/60 px-2 py-1 bg-background/70">
                男 {genderStats.male} / 女 {genderStats.female} / 未知 {genderStats.unknown}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-start gap-2 sm:items-center sm:gap-3 mb-5 rounded-lg border border-border/60 bg-muted/20 p-3">
          <label className="flex w-full sm:w-auto items-center gap-2 text-sm text-muted-foreground">
            名称
            <Input
              type="text"
              value={recordName}
              onChange={e => setRecordName(e.target.value)}
              placeholder="输入名称（用于保存历史和导出文件名）"
              className="h-8 w-full sm:w-72"
            />
          </label>
          {MODES.map(m => (
            <button key={m.id} onClick={() => setMode(m.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${mode === m.id ? 'bg-primary text-primary-foreground border-primary shadow-soft' : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted'}`}
              title={m.desc}>{m.icon}{m.label}</button>
          ))}
          <div className="flex items-center gap-1 ml-2 border-l border-border pl-2">
            <Button variant="outline" size="sm" onClick={addColAisle} className="gap-1 text-xs h-8" title={t('seat.colAisle')}>
              <Plus className="w-3 h-3" /> {t('seat.colAisle')}
            </Button>
            <Button variant="outline" size="sm" onClick={addRowAisle} className="gap-1 text-xs h-8" title={t('seat.rowAisle')}>
              <Plus className="w-3 h-3" /> {t('seat.rowAisle')}
            </Button>
          </div>
          <div className="flex w-full sm:w-auto sm:min-w-[24rem] items-center gap-2 rounded-md border border-border/60 bg-background/80 px-2 py-1">
            <Button variant="outline" onClick={saveClassroomToHistory} className="gap-2 h-8" disabled={seats.length === 0}>
              <Save className="w-4 h-4" /> 保存历史
            </Button>
            <select
              value={selectedHistoryId}
              onChange={e => setSelectedHistoryId(e.target.value)}
              className="h-8 min-w-0 flex-1 sm:max-w-72 px-2 rounded-md border border-input bg-background text-foreground text-sm"
            >
              <option value="">选择历史记录</option>
              {historyItems.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name}（{new Date(item.createdAt).toLocaleString()}）
                </option>
              ))}
            </select>
            <Button variant="outline" onClick={restoreClassroomFromHistory} disabled={!selectedHistoryId} className="gap-2 h-8">
              <RotateCcw className="w-4 h-4" /> 恢复历史
            </Button>
          </div>
          {seats.length > 0 && (
            <ExportButtons
              targetRef={printRef}
              filename={recordName.trim() || t('seat.exportName')}
              resolveQrCode={resolveQrCode}
              titleValue={recordName}
              onTitleChange={setRecordName}
              hideTitleInput
            />
          )}
          {seats.length > 0 && (
            <Button
              onClick={() => setCheckinOpen(true)}
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md ring-2 ring-primary/30 font-semibold"
            >
              <ClipboardCheck className="w-4 h-4" />
              {t('seat.checkin')}
            </Button>
          )}
          <Button onClick={autoSeat} className="gap-2 ml-auto">
            <LayoutGrid className="w-4 h-4" /> {t('seat.autoSeat')}
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              setSeats(Array.from({ length: rows }, () => Array.from({ length: cols }, () => null)));
            }}
            title="清空所有座位"
          >
            <X className="w-4 h-4" /> 清空座位
          </Button>
        </div>

        {(colAisles.length > 0 || rowAisles.length > 0) && (
          <div className="flex flex-wrap gap-2 mb-3">
            {colAisles.map(a => (
              <span key={`ca-${a}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-xs text-muted-foreground">
                {t('seat.colAisleAfter').replace('{0}', String(a + 1))}
                <button onClick={() => removeColAisle(a)} className="hover:text-destructive"><X className="w-3 h-3" /></button>
              </span>
            ))}
            {rowAisles.map(a => (
              <span key={`ra-${a}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-xs text-muted-foreground">
                {t('seat.rowAisleAfter').replace('{0}', String(a + 1))}
                <button onClick={() => removeRowAisle(a)} className="hover:text-destructive"><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        )}

        {organizationLegend.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3 rounded-md border border-border/60 bg-muted/20 px-2 py-2">
            {organizationLegend.map(([organization, colorClass]) => (
              <span key={organization} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-background border border-border/60 text-xs">
                <span className={`inline-block w-2 h-2 rounded-full bg-current ${colorClass}`} />
                <span className={colorClass}>{organization}</span>
              </span>
            ))}
          </div>
        )}

        <div ref={printRef}>
          <div className="mb-4 flex items-center justify-center gap-3">
            <div className="cursor-default select-none" title={windowOnLeft ? t('seat.window') : t('seat.door')}>
              {windowOnLeft ? <span className={sideIconClass}>🪟</span> : <span className={sideIconClass}>🚪</span>}
            </div>
            <div className="bg-primary/10 text-primary px-8 py-2 rounded-lg text-sm font-medium border border-primary/20">
              {t('seat.podium')}
            </div>
            <div className="cursor-default select-none" title={windowOnLeft ? t('seat.door') : t('seat.window')}>
              {windowOnLeft ? <span className={sideIconClass}>🚪</span> : <span className={sideIconClass}>🪟</span>}
            </div>
            <button onClick={() => setWindowOnLeft(prev => !prev)}
              className="ml-1 p-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title={t('seat.swapDoorWindow')}>
              <ArrowRightLeft className="w-4 h-4" />
            </button>
          </div>

          {seats.length > 0 ? (
            <div className="overflow-auto pb-2">
              <div className="flex justify-center">
                <div className="inline-flex items-stretch gap-2 min-w-max min-h-max">
                  <div className="flex items-center shrink-0">
                    <div className="flex flex-col items-center gap-1 text-[11px] text-muted-foreground">
                      <span className={sideMarkerIconClass}>{windowOnLeft ? '🪟' : '🚪'}</span>
                      <span className="writing-vertical tracking-widest">{windowOnLeft ? t('seat.windowSide') : t('seat.doorSide')}</span>
                    </div>
                  </div>
                  <div className="shrink-0">{buildVisualGrid()}</div>
                  <div className="flex items-center shrink-0">
                    <div className="flex flex-col items-center gap-1 text-[11px] text-muted-foreground">
                      <span className={sideMarkerIconClass}>{windowOnLeft ? '🚪' : '🪟'}</span>
                      <span className="writing-vertical tracking-widest">{windowOnLeft ? t('seat.doorSide') : t('seat.windowSide')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-20 text-muted-foreground">
              <p className="text-lg mb-2">{t('seat.emptyTitle')}</p>
              <p className="text-sm">{t('seat.emptyDesc')}</p>
            </div>
          )}
        </div>

        {seats.length > 0 && (
          <p className="text-center text-xs text-muted-foreground mt-4">{t('seat.legend')}</p>
        )}
        <SeatCheckinDialog open={checkinOpen} onOpenChange={setCheckinOpen} seatData={seats} studentNames={students.map(s => s.name)} seatAssignmentReady={seats.length > 0} sceneType="classroom"
          sceneConfig={exportSceneConfig} className={recordName.trim() || exportClassName} pngFileName={recordName.trim() || t('seat.exportName')} onSessionCreated={({ checkinUrl }) => handleSessionCreated(checkinUrl)} />
        </>)}
      </div>
    </div>
  );
}

const getVisualRow = getVisualRowUtil;
