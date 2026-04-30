import { useState, useRef, useEffect, useMemo, type MouseEvent as ReactMouseEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LayoutGrid, Shuffle, QrCode, Save, RotateCcw, Users, Trash2, Pencil } from 'lucide-react';
import ExportButtons from '@/components/ExportButtons';
import SeatCheckinDialog from '@/components/SeatCheckinDialog';
import TitleRankConfigDialog from './TitleRankConfigDialog';
import { useRoundTableDrag } from './useRoundTableDrag';
import { useSeatExportQr } from './useSeatExportQr';
import ZoomControls, { useSceneZoom, useZoomGestures } from './ZoomControls';
import { toast } from 'sonner';
import { buildOrganizationColorResolver } from '@/lib/org-color';
import { buildTitleScorer, loadTitleRankRuleText, saveTitleRankRuleText } from '@/lib/title-rank';
import {
  loadLastGroups,
  saveLastGroups,
  groupsFromSeatAssignment,
  loadBanquetHallSnapshot,
  saveBanquetHallSnapshot,
  loadBanquetHallHistory,
  saveBanquetHallHistory,
  type BanquetHallHistoryItem,
  type BanquetHallSnapshot,
  deleteSeatHistoryLocal,
  renameSeatHistoryLocal,
} from '@/lib/teamwork-local';
import { saveCloudSeatHistory, fetchCloudSeatHistory, migrateLocalToCloudOnce, deleteCloudSeatHistory, renameCloudSeatHistory } from '@/lib/seat-history-cloud';
import { useLanguage, tFormat } from '@/contexts/LanguageContext';

interface Props {
  students: { id: string; name: string; organization?: string; title?: string }[];
}

type BanquetSeatMode = 'tableRoundRobin' | 'tableGrouped' | 'verticalS' | 'horizontalS' | 'orgTableStage';
type RefKey = 'screen' | 'podium' | 'window' | 'frontDoor' | 'backDoor';
type RefPositions = Record<RefKey, { x: number; y: number }>;
type RefVisible = Record<RefKey, boolean>;

function buildDefaultRefPositions(roomWidth: number, roomHeight: number): RefPositions {
  const badgeW = 94;
  const centerX = Math.round((roomWidth - badgeW) / 2);
  const rightX = Math.max(24, roomWidth - badgeW - 24);
  const midY = Math.max(20, Math.round((roomHeight - 32) / 2));
  return {
    screen: { x: centerX, y: 22 },
    podium: { x: centerX, y: 74 },
    window: { x: 24, y: midY },
    frontDoor: { x: rightX, y: 120 },
    backDoor: { x: rightX, y: Math.max(180, roomHeight - 56) },
  };
}

export default function BanquetHall({ students }: Props) {
  const { t } = useLanguage();
  const initialTableCount = Math.max(1, Math.ceil(students.length / 10));
  const initialTableCols = Math.max(1, Math.ceil(Math.sqrt(initialTableCount)));
  const initialTableRows = Math.max(1, Math.ceil(initialTableCount / initialTableCols));

  const [seatsPerTable, setSeatsPerTable] = useState(10);
  const [tableCols, setTableCols] = useState(initialTableCols);
  const [tableRows, setTableRows] = useState(initialTableRows);
  const [tableCount, setTableCount] = useState(initialTableCount);
  const [groupCount, setGroupCount] = useState(4);
  const [mode, setMode] = useState<BanquetSeatMode>('orgTableStage');
  const [assignment, setAssignment] = useState<string[][]>([]);
  const [closedSeats, setClosedSeats] = useState<Set<string>>(new Set());
  const [reservedTables, setReservedTables] = useState<Set<number>>(new Set());
  const [tableGap, setTableGap] = useState(24);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [tablePositions, setTablePositions] = useState<{ x: number; y: number }[]>([]);
  const [recordName, setRecordName] = useState('');
  const [historyItems, setHistoryItems] = useState<BanquetHallHistoryItem[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState('');
  const [linkedGroupNames, setLinkedGroupNames] = useState<string[]>([]);
  const [titleRankRuleText, setTitleRankRuleText] = useState(() => loadTitleRankRuleText('banquet'));
  const [showOrgColorMark, setShowOrgColorMark] = useState(true);
  const [selectedTableIndex, setSelectedTableIndex] = useState<number | null>(null);
  const [selectedSeat, setSelectedSeat] = useState<{ table: number; seat: number } | null>(null);

  const [refVisible, setRefVisible] = useState<RefVisible>({
    screen: true,
    podium: true,
    window: true,
    frontDoor: true,
    backDoor: true,
  });
  const [refLocked, setRefLocked] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<{ index: number; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const refDraggingRef = useRef<{ key: RefKey; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const seatDraggingRef = useRef(false);
  const restoredOnceRef = useRef(false);

  const { dragFrom, dropTarget, handleDragStart, handleDragOver, handleDrop, handleDragEnd } = useRoundTableDrag(assignment, setAssignment);

  const seatKey = (tableIndex: number, seatIndex: number) => `${tableIndex}-${seatIndex}`;

  const toggleSeatOpen = (tableIndex: number, seatIndex: number) => {
    const key = seatKey(tableIndex, seatIndex);
    setClosedSeats(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleTableReserved = (tableIndex: number) => {
    setReservedTables(prev => {
      const next = new Set(prev);
      if (next.has(tableIndex)) {
        next.delete(tableIndex);
      } else {
        next.add(tableIndex);
        setAssignment(current => {
          const copied = current.map(row => [...row]);
          if (!copied[tableIndex]) return copied;
          copied[tableIndex] = copied[tableIndex].map(() => '');
          return copied;
        });
      }
      return next;
    });
  };

  const toPositiveInt = (value: number, fallback = 1) => {
    if (!Number.isFinite(value)) return fallback;
    const normalized = Math.floor(value);
    return normalized > 0 ? normalized : fallback;
  };

  const applyGridSize = (nextRows: number, nextCols: number) => {
    setTableRows(nextRows);
    setTableCols(nextCols);
    setTableCount(nextRows * nextCols);
  };

  const handleRowsChange = (raw: string) => {
    const nextRows = toPositiveInt(Number(raw), tableRows);
    applyGridSize(nextRows, tableCols);
  };

  const handleColsChange = (raw: string) => {
    const nextCols = toPositiveInt(Number(raw), tableCols);
    applyGridSize(tableRows, nextCols);
  };

  const handleTableCountChange = (raw: string) => {
    const nextCount = toPositiveInt(Number(raw), tableCount);
    setTableCount(nextCount);
    setTableRows(Math.max(1, Math.ceil(nextCount / tableCols)));
  };

  const tableCellSize = 170;
  const tStageRunwayWidth = 56;
  const hasTStage = refVisible.podium;
  const splitIndex = Math.ceil(tableCols / 2);

  const roomWidth = Math.max(980, tableCols * 180 + Math.max(0, tableCols - 1) * tableGap + 260);
  const roomHeight = Math.max(720, tableRows * 180 + Math.max(0, tableRows - 1) * tableGap + 280);
  const zoom = useSceneZoom({ contentWidth: roomWidth, contentHeight: roomHeight });
  useZoomGestures({ setScale: zoom.setScale, targetRef: zoom.containerRef });

  const tStageTopWidth = Math.max(320, Math.min(roomWidth * 0.56, tableCols * 180));
  const tStageTopY = 116;
  const tStageTopHeight = 28;
  const tStageRunwayTop = tStageTopY + tStageTopHeight - 2;
  const tStageRunwayBottom = roomHeight - 64;
  const tStageRunwayHeight = Math.max(120, tStageRunwayBottom - tStageRunwayTop);

  const defaultRefPositions = useMemo(() => buildDefaultRefPositions(roomWidth, roomHeight), [roomWidth, roomHeight]);
  const [refPositions, setRefPositions] = useState<RefPositions>(() => buildDefaultRefPositions(980, 720));

  const exportSceneConfig = {
    seatsPerTable, tableCount, tableCols, tableRows,
    roomWidth, roomHeight,
    frontDoor: refVisible.frontDoor ? refPositions.frontDoor : null,
    backDoor: refVisible.backDoor ? refPositions.backDoor : null,
  };
  const { className: exportClassName, resolveQrCode, handleSessionCreated } = useSeatExportQr({
    seatData: assignment,
    studentNames: students.map(s => s.name),
    sceneConfig: exportSceneConfig,
    sceneType: 'banquet',
  });
  const refBadgeClass = 'absolute h-8 pl-2 pr-2.5 rounded-lg border border-primary/30 bg-primary/10 text-primary shadow-sm cursor-move select-none inline-flex items-center gap-1.5';
  const refIconClass = 'inline-flex items-center justify-center w-5 h-5 rounded-md border border-primary/30 bg-background/80 text-[11px] leading-none';
  const refTextClass = 'text-[11px] font-medium leading-none tracking-wide';

  const buildSnapshot = (): BanquetHallSnapshot => ({
    seatsPerTable,
    tableCount,
    tableCols,
    tableRows,
    groupCount,
    mode,
    tableGap,
    assignment,
    closedSeats: Array.from(closedSeats),
    reservedTables: Array.from(reservedTables),
    updatedAt: new Date().toISOString(),
  });

  const placeName = (tables: string[][], preferred: number, name: string) => {
    const order = [preferred, ...Array.from({ length: tableCount }, (_, i) => i).filter(i => i !== preferred)]
      .filter(tableIdx => !reservedTables.has(tableIdx));
    for (const tableIdx of order) {
      for (let seatIdx = 0; seatIdx < seatsPerTable; seatIdx++) {
        if (closedSeats.has(seatKey(tableIdx, seatIdx))) continue;
        if (!tables[tableIdx][seatIdx]) {
          tables[tableIdx][seatIdx] = name;
          return;
        }
      }
    }
  };

  const splitIntoGroups = (names: string[], count: number) => {
    const groups: string[][] = Array.from({ length: count }, () => []);
    names.forEach((n, i) => groups[i % count].push(n));
    return groups;
  };

  const scoreTitle = useMemo(() => buildTitleScorer(titleRankRuleText), [titleRankRuleText]);

  const orgByName = useMemo(() => {
    const map = new Map<string, string>();
    students.forEach(student => {
      const org = student.organization?.trim();
      if (org) map.set(student.name, org);
    });
    return map;
  }, [students]);

  const resolveOrgColor = useMemo(() => buildOrganizationColorResolver(Array.from(orgByName.values())), [orgByName]);

  const getNameColor = (name: string) => {
    if (!showOrgColorMark) return undefined;
    const org = orgByName.get(name);
    if (!org) return undefined;
    return resolveOrgColor(org);
  };

  const getStagePriorityTableOrder = () => {
    const center = (tableCols - 1) / 2;
    return Array.from({ length: tableCount }, (_, i) => i)
      .filter(index => !reservedTables.has(index))
      .sort((a, b) => {
        const rowA = Math.floor(a / tableCols);
        const rowB = Math.floor(b / tableCols);
        if (rowA !== rowB) return rowA - rowB;
        const colA = a % tableCols;
        const colB = b % tableCols;
        const centerDistA = Math.abs(colA - center);
        const centerDistB = Math.abs(colB - center);
        if (centerDistA !== centerDistB) return centerDistA - centerDistB;
        return colA - colB;
      });
  };

  const getSeatOrderNearStage = () => {
    const radius = 60;
    return Array.from({ length: seatsPerTable }, (_, i) => i)
      .sort((a, b) => {
        const angleA = (2 * Math.PI * a) / seatsPerTable - Math.PI / 2;
        const angleB = (2 * Math.PI * b) / seatsPerTable - Math.PI / 2;
        const yA = radius * Math.sin(angleA);
        const yB = radius * Math.sin(angleB);
        if (yA !== yB) return yA - yB;
        return Math.abs(Math.cos(angleA)) - Math.abs(Math.cos(angleB));
      });
  };

  const getColumnPriorityNearStage = () => {
    const center = (tableCols - 1) / 2;
    return Array.from({ length: tableCols }, (_, col) => col)
      .sort((a, b) => {
        const da = Math.abs(a - center);
        const db = Math.abs(b - center);
        if (da !== db) return da - db;
        return a - b;
      });
  };

  const getTableSide = (tableIndex: number) => {
    if (!hasTStage || tableCols <= 1) return 'all' as const;
    const col = tableIndex % tableCols;
    return col < splitIndex ? 'left' as const : 'right' as const;
  };

  const getSideColumnTablesNearStage = () => {
    const map = new Map<string, number[]>();

    for (let col = 0; col < tableCols; col++) {
      const keyLeft = `left:${col}`;
      const keyRight = `right:${col}`;
      const keyAll = `all:${col}`;

      const tables = Array.from({ length: tableRows }, (_, row) => row * tableCols + col)
        .filter(index => index < tableCount && !reservedTables.has(index))
        .sort((a, b) => Math.floor(a / tableCols) - Math.floor(b / tableCols));

      if (!hasTStage || tableCols <= 1) {
        map.set(keyAll, tables);
      } else {
        map.set(keyLeft, tables.filter(index => getTableSide(index) === 'left'));
        map.set(keyRight, tables.filter(index => getTableSide(index) === 'right'));
      }
    }

    return map;
  };

  const applyGroupsToSeat = (fromGroups: ReturnType<typeof loadLastGroups>) => {
    const availableNames = new Set(students.map(s => s.name));
    const filteredGroups = fromGroups
      .map(group => ({
        ...group,
        members: group.members.filter(member => availableNames.has(member.name)),
      }))
      .filter(group => group.members.length > 0);

    if (filteredGroups.length === 0) {
      toast.error(t('seat.editor.banquet.noUsableGroups'));
      return false;
    }

    const nextTableCount = filteredGroups.length;
    const maxGroupSize = Math.max(...filteredGroups.map(group => group.members.length));
    const nextSeatsPerTable = Math.max(6, maxGroupSize);
    const nextTableCols = Math.max(1, Math.min(tableCols, nextTableCount));
    const nextTableRows = Math.max(1, Math.ceil(nextTableCount / nextTableCols));
    const nextAssignment = Array.from({ length: nextTableCount }, (_, index) => {
      const row = filteredGroups[index]?.members.map(member => member.name) ?? [];
      if (row.length >= nextSeatsPerTable) return row.slice(0, nextSeatsPerTable);
      return [...row, ...Array.from({ length: nextSeatsPerTable - row.length }, () => '')];
    });

    setSeatsPerTable(nextSeatsPerTable);
    setTableCount(nextTableCount);
    setTableCols(nextTableCols);
    setTableRows(nextTableRows);
    setGroupCount(nextTableCount);
    setMode('tableGrouped');
    setLinkedGroupNames(filteredGroups.map(group => group.name));
    setAssignment(nextAssignment);
    setReservedTables(new Set());
    return true;
  };

  const getTableOrder = (seatMode: BanquetSeatMode) => {
    const cols = tableCols;
    const rows = tableRows;
    const order: number[] = [];

    if (seatMode === 'verticalS') {
      for (let c = 0; c < cols; c++) {
        for (let ri = 0; ri < rows; ri++) {
          const r = c % 2 === 0 ? ri : rows - 1 - ri;
          const idx = r * cols + c;
          if (idx < tableCount) order.push(idx);
        }
      }
      return order;
    }

    if (seatMode === 'horizontalS') {
      for (let r = 0; r < rows; r++) {
        for (let ci = 0; ci < cols; ci++) {
          const c = r % 2 === 0 ? ci : cols - 1 - ci;
          const idx = r * cols + c;
          if (idx < tableCount) order.push(idx);
        }
      }
      return order;
    }

    return Array.from({ length: tableCount }, (_, i) => i);
  };

  const autoSeat = (shuffle = false) => {
    const names = shuffle
      ? [...students.map(s => s.name)].sort(() => Math.random() - 0.5)
      : students.map(s => s.name);
    const tables: string[][] = Array.from({ length: tableCount }, () => Array.from({ length: seatsPerTable }, () => ''));

    if (mode === 'orgTableStage' && !shuffle) {
      const seatOrder = getSeatOrderNearStage();
      const columnPriority = getColumnPriorityNearStage();
      const sideColumnTables = getSideColumnTablesNearStage();

      const groupsMap = new Map<string, Array<{ name: string; score: number }>>();
      students.forEach(student => {
        const org = student.organization?.trim() || t('seat.editor.common.unassignedOrg');
        const item = { name: student.name, score: scoreTitle(student.title) };
        const bucket = groupsMap.get(org);
        if (bucket) bucket.push(item);
        else groupsMap.set(org, [item]);
      });

      const groups = Array.from(groupsMap.values())
        .map(group => group.sort((a, b) => b.score - a.score))
        .sort((a, b) => {
          const topScoreDiff = (b[0]?.score ?? 0) - (a[0]?.score ?? 0);
          if (topScoreDiff !== 0) return topScoreDiff;
          return b.length - a.length;
        });

      const sides = (!hasTStage || tableCols <= 1) ? (['all'] as const) : (['left', 'right'] as const);

      const getRemainForSideColumn = (side: 'left' | 'right' | 'all', col: number) => {
        const tablesInBucket = sideColumnTables.get(`${side}:${col}`) || [];
        let remain = 0;
        for (const tableIndex of tablesInBucket) {
          for (const seatIndex of seatOrder) {
            if (closedSeats.has(seatKey(tableIndex, seatIndex))) continue;
            if (!tables[tableIndex][seatIndex]) remain++;
          }
        }
        return remain;
      };

      const placeInSideColumn = (side: 'left' | 'right' | 'all', col: number, group: Array<{ name: string; score: number }>, startCursor: number) => {
        const tablesInBucket = sideColumnTables.get(`${side}:${col}`) || [];
        let cursor = startCursor;
        for (const tableIndex of tablesInBucket) {
          for (const seatIndex of seatOrder) {
            if (cursor >= group.length) return cursor;
            if (closedSeats.has(seatKey(tableIndex, seatIndex))) continue;
            if (tables[tableIndex][seatIndex]) continue;
            tables[tableIndex][seatIndex] = group[cursor].name;
            cursor++;
          }
        }
        return cursor;
      };

      groups.forEach(group => {
        let cursor = 0;

        // 1) Pick one primary side (when T-stage exists) with most remaining capacity.
        let primarySide: 'left' | 'right' | 'all' = sides[0];
        let bestSideRemain = -1;
        sides.forEach(side => {
          const sideRemain = columnPriority.reduce((sum, col) => sum + getRemainForSideColumn(side, col), 0);
          if (sideRemain > bestSideRemain) {
            bestSideRemain = sideRemain;
            primarySide = side;
          }
        });

        // 2) Inside the primary side, keep one organization in one column first.
        let primaryCol = columnPriority[0];
        let bestColRemain = -1;
        columnPriority.forEach(col => {
          const remain = getRemainForSideColumn(primarySide, col);
          if (remain > bestColRemain) {
            bestColRemain = remain;
            primaryCol = col;
          }
        });

        cursor = placeInSideColumn(primarySide, primaryCol, group, cursor);

        // 3) Overflow within the same side, other columns.
        if (cursor < group.length) {
          columnPriority
            .filter(col => col !== primaryCol)
            .forEach(col => {
              if (cursor >= group.length) return;
              cursor = placeInSideColumn(primarySide, col, group, cursor);
            });
        }

        // 4) Last resort: spill to the other side.
        if (cursor < group.length) {
          sides
            .filter(side => side !== primarySide)
            .forEach(side => {
              columnPriority.forEach(col => {
                if (cursor >= group.length) return;
                cursor = placeInSideColumn(side, col, group, cursor);
              });
            });
        }
      });

      setAssignment(tables);
      return;
    }

    if (mode === 'tableGrouped') {
      const cachedGroups = loadLastGroups();
      if (cachedGroups.length > 0 && !shuffle) {
        const ok = applyGroupsToSeat(cachedGroups);
        if (ok) return;
      }

      const groups = splitIntoGroups(names, Math.max(1, groupCount));
      groups.forEach((group, gi) => {
        group.forEach(n => placeName(tables, gi % tableCount, n));
      });
      setAssignment(tables);
      return;
    }

    const order = getTableOrder(mode);
    names.forEach((n, i) => placeName(tables, order[i % order.length], n));
    setAssignment(tables);
  };

  const saveToHistory = async () => {
    if (assignment.length === 0) {
      toast.error(t('seat.editor.banquet.noSeatsToSave'));
      return;
    }
    const name = recordName.trim() || `${t('seat.editor.scene.banquet')}-${new Date().toLocaleString()}`;
    const item = saveBanquetHallHistory(name, buildSnapshot());
    let savedItem: BanquetHallHistoryItem = item;
    const cloud = await saveCloudSeatHistory('banquet', name, item.snapshot);
    if (cloud) savedItem = { id: cloud.id, name: cloud.name, createdAt: cloud.createdAt, snapshot: cloud.snapshot } as BanquetHallHistoryItem;
    const nextItems = [savedItem, ...historyItems].slice(0, 50);
    setHistoryItems(nextItems);
    setSelectedHistoryId(savedItem.id);
    setRecordName(name);
    saveBanquetHallSnapshot(item.snapshot);
    toast.success(cloud ? t('seat.editor.banquet.savedHistoryCloud') : t('seat.editor.banquet.savedHistoryLocal'));
  };

  const restoreFromHistory = () => {
    const item = historyItems.find(history => history.id === selectedHistoryId);
    if (!item) {
      toast.error(t('seat.editor.banquet.noHistorySelected'));
      return;
    }
    const snapshot = item.snapshot;
    const validStudentNames = new Set(students.map(s => s.name));
    const sanitizedAssignment = snapshot.assignment.map(table =>
      table.map(name => (validStudentNames.has(name) ? name : ''))
    );

    setSeatsPerTable(Math.max(6, snapshot.seatsPerTable));
    setTableCount(Math.max(1, snapshot.tableCount));
    setTableCols(Math.max(1, snapshot.tableCols));
    setTableRows(Math.max(1, snapshot.tableRows));
    setGroupCount(Math.max(1, snapshot.groupCount));
    setMode(snapshot.mode);
    setTableGap(Math.max(0, snapshot.tableGap));
    setAssignment(sanitizedAssignment);
    setClosedSeats(new Set(snapshot.closedSeats || []));
    setReservedTables(new Set(snapshot.reservedTables || []));
    setRecordName(item.name);
    saveBanquetHallSnapshot({ ...snapshot, assignment: sanitizedAssignment });
    toast.success(t('seat.editor.banquet.restoredHistory'));
  };

  const seatByLastGroups = () => {
    const cachedGroups = loadLastGroups();
    if (cachedGroups.length === 0) {
      toast.error(t('seat.editor.banquet.noUsableGroups'));
      return;
    }
    const ok = applyGroupsToSeat(cachedGroups);
    if (ok) {
      toast.success(t('seat.editor.banquet.byGroupGenerated'));
    }
  };

  useEffect(() => {
    const requiredTableCount = Math.max(1, Math.ceil(students.length / Math.max(1, seatsPerTable)));
    if (requiredTableCount <= tableCount) return;
    setTableCount(requiredTableCount);
    setTableRows(Math.max(1, Math.ceil(requiredTableCount / tableCols)));
  }, [students.length, seatsPerTable, tableCols, tableCount]);

  useEffect(() => {
    setTablePositions(Array.from({ length: tableCount }, () => ({ x: 0, y: 0 })));
  }, [tableCount]);

  useEffect(() => {
    if (!hasTStage) return;
    setTablePositions(Array.from({ length: tableCount }, () => ({ x: 0, y: 0 })));
  }, [hasTStage, tableCount]);

  useEffect(() => {
    setRefPositions(defaultRefPositions);
  }, [defaultRefPositions]);

  useEffect(() => {
    setClosedSeats(prev => {
      const next = new Set<string>();
      prev.forEach(key => {
        const [tableStr, seatStr] = key.split('-');
        const t = Number(tableStr);
        const s = Number(seatStr);
        if (t < tableCount && s < seatsPerTable) next.add(key);
      });
      return next;
    });
  }, [tableCount, seatsPerTable]);

  useEffect(() => {
    setReservedTables(prev => {
      const next = new Set<number>();
      prev.forEach(index => {
        if (index < tableCount) next.add(index);
      });
      return next;
    });
  }, [tableCount]);

  useEffect(() => {
    setHistoryItems(loadBanquetHallHistory());
    (async () => {
      await migrateLocalToCloudOnce('banquet');
      const cloud = await fetchCloudSeatHistory<BanquetHallHistoryItem['snapshot']>('banquet');
      if (cloud) setHistoryItems(cloud.map(r => ({ id: r.id, name: r.name, createdAt: r.createdAt, snapshot: r.snapshot })) as BanquetHallHistoryItem[]);
    })();
  }, []);

  useEffect(() => {
    if (restoredOnceRef.current) return;
    const snapshot = loadBanquetHallSnapshot();
    if (snapshot && snapshot.assignment.length > 0) {
      const validStudentNames = new Set(students.map(s => s.name));
      const sanitizedAssignment = snapshot.assignment.map(table =>
        table.map(name => (validStudentNames.has(name) ? name : ''))
      );
      setSeatsPerTable(Math.max(6, snapshot.seatsPerTable));
      setTableCount(Math.max(1, snapshot.tableCount));
      setTableCols(Math.max(1, snapshot.tableCols));
      setTableRows(Math.max(1, snapshot.tableRows));
      setGroupCount(Math.max(1, snapshot.groupCount));
      setMode(snapshot.mode);
      setTableGap(Math.max(0, snapshot.tableGap));
      setAssignment(sanitizedAssignment);
      setClosedSeats(new Set(snapshot.closedSeats || []));
      setReservedTables(new Set(snapshot.reservedTables || []));
    }
    restoredOnceRef.current = true;
  }, [students]);

  useEffect(() => {
    if (assignment.length === 0) return;

    const nextGroups = groupsFromSeatAssignment(assignment, linkedGroupNames);
    if (nextGroups.length > 0) {
      saveLastGroups(nextGroups);
      const nextNames = nextGroups.map(group => group.name);
      if (nextNames.join('|') !== linkedGroupNames.join('|')) {
        setLinkedGroupNames(nextNames);
      }
    }

    saveBanquetHallSnapshot(buildSnapshot());
  }, [assignment, seatsPerTable, tableCount, tableCols, tableRows, groupCount, mode, tableGap, closedSeats, reservedTables, linkedGroupNames]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingRef.current) {
        const dx = e.clientX - draggingRef.current.startX;
        const dy = e.clientY - draggingRef.current.startY;
        const nextX = hasTStage ? 0 : draggingRef.current.origX + dx;
        const nextY = draggingRef.current.origY + dy;
        setTablePositions(pos => pos.map((p, i) =>
          i === draggingRef.current!.index
            ? { x: nextX, y: nextY }
            : p
        ));
      }

      if (refDraggingRef.current) {
        const dx = e.clientX - refDraggingRef.current.startX;
        const dy = e.clientY - refDraggingRef.current.startY;
        const key = refDraggingRef.current.key;
        setRefPositions(prev => ({
          ...prev,
          [key]: {
            x: refDraggingRef.current!.origX + dx,
            y: refDraggingRef.current!.origY + dy,
          },
        }));
      }
    };

    const handleMouseUp = () => {
      draggingRef.current = null;
      refDraggingRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [hasTStage]);

  const startTableDrag = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    if (selectedTableIndex !== index) {
      setSelectedTableIndex(index);
      return;
    }
    if (seatDraggingRef.current) return;
    draggingRef.current = {
      index,
      startX: e.clientX,
      startY: e.clientY,
      origX: tablePositions[index]?.x || 0,
      origY: tablePositions[index]?.y || 0,
    };
  };

  const toggleRefVisible = (key: RefKey) => {
    setRefVisible(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const startRefDrag = (e: ReactMouseEvent, key: RefKey) => {
    if (refLocked) return;
    e.preventDefault();
    e.stopPropagation();
    refDraggingRef.current = {
      key,
      startX: e.clientX,
      startY: e.clientY,
      origX: refPositions[key].x,
      origY: refPositions[key].y,
    };
  };

  const renderBanquetTable = (tableIndex: number, people: string[]) => {
    const radius = 60;
    const seatRadius = 16;
    const cx = 85;
    const cy = 85;
    const totalSlots = seatsPerTable;
    const pos = tablePositions[tableIndex] || { x: 0, y: 0 };
    const isReservedTable = reservedTables.has(tableIndex);
    const assignedCount = people.filter(name => !!name).length;
    const isTableSelected = selectedTableIndex === tableIndex;

    return (
      <div
        key={tableIndex}
        className={`flex flex-col items-center ${isTableSelected ? 'cursor-grab' : 'cursor-pointer'}`}
        style={{ transform: `translate(${pos.x}px,${pos.y}px)` }}
        onMouseDown={e => startTableDrag(e, tableIndex)}
        onClick={() => setSelectedTableIndex(tableIndex)}
      >
        <svg width={170} height={170} viewBox="0 0 170 170" className="font-sans" style={{ fontFamily: 'var(--font-family)' }}>
          <circle cx={cx} cy={cy} r={42} className="fill-primary/5 stroke-primary/20" strokeWidth={1} strokeDasharray="4 2" />
          <g
            onDoubleClick={e => {
              e.preventDefault();
              e.stopPropagation();
              toggleTableReserved(tableIndex);
            }}
            onClick={e => {
              e.stopPropagation();
              setSelectedTableIndex(tableIndex);
            }}
            style={{ cursor: 'pointer' }}
          >
            <circle
              cx={cx}
              cy={cy}
              r={36}
              className={isReservedTable ? 'fill-amber-100 stroke-amber-500' : 'fill-primary/10 stroke-primary/30'}
              strokeWidth={isTableSelected ? 3 : 2}
            />
            <text x={cx} y={cy - 6} textAnchor="middle" dominantBaseline="middle" className={isReservedTable ? 'fill-amber-700 text-sm font-semibold' : 'fill-primary text-sm font-medium'}>
              T{tableIndex + 1}
            </text>
            <text x={cx} y={cy + 8} textAnchor="middle" dominantBaseline="middle" className={isReservedTable ? 'fill-amber-700 text-xs font-semibold' : 'fill-primary/60 text-xs'}>
              {isReservedTable ? t('seat.editor.common.reserved') : `${assignedCount}`}
            </text>
          </g>
          {Array.from({ length: totalSlots }).map((_, i) => {
            const angle = (2 * Math.PI * i) / totalSlots - Math.PI / 2;
            const sx = cx + radius * Math.cos(angle);
            const sy = cy + radius * Math.sin(angle);
            const name = people[i] || '';
            const isClosed = closedSeats.has(seatKey(tableIndex, i));
            const isDragging = dragFrom?.table === tableIndex && dragFrom?.seat === i;
            const isOver = dropTarget?.table === tableIndex && dropTarget?.seat === i;
            const isSeatSelected = selectedSeat?.table === tableIndex && selectedSeat?.seat === i;
            return (
              <g
                key={i}
                style={{ cursor: name && !isClosed ? 'grab' : 'pointer' }}
                onMouseDown={name && !isClosed ? (e) => {
                  if (isReservedTable) return;
                  if (!isSeatSelected) {
                    setSelectedSeat({ table: tableIndex, seat: i });
                    return;
                  }
                  e.preventDefault();
                  e.stopPropagation();
                  seatDraggingRef.current = true;
                  handleDragStart(tableIndex, i);
                } : undefined}
                onMouseEnter={() => { if (dragFrom && !isClosed && !isReservedTable) handleDragOver(tableIndex, i); }}
                onMouseUp={() => {
                  if (dragFrom && !isClosed && !isReservedTable) handleDrop(tableIndex, i);
                  seatDraggingRef.current = false;
                }}
                onClick={e => {
                  e.stopPropagation();
                  setSelectedSeat({ table: tableIndex, seat: i });
                }}
                onDoubleClick={e => {
                  e.stopPropagation();
                  if (!name && !isReservedTable) toggleSeatOpen(tableIndex, i);
                }}
              >
                <circle
                  cx={sx}
                  cy={sy}
                  r={seatRadius}
                  className={
                    isReservedTable ? 'fill-amber-50 stroke-amber-200' :
                    isClosed ? 'fill-muted stroke-destructive/60' :
                    isDragging ? 'fill-primary/20 stroke-primary' :
                    isOver ? 'fill-accent stroke-primary' :
                    isSeatSelected ? 'fill-accent/70 stroke-primary' :
                    name ? 'fill-card stroke-border hover:stroke-primary/50' : 'fill-muted/30 stroke-border/30'
                  }
                  strokeWidth={isOver || isSeatSelected ? 2.5 : 1.5}
                  style={{ transition: 'all 0.15s' }}
                />
                {isClosed && (
                  <text x={sx} y={sy + 1} textAnchor="middle" dominantBaseline="middle" className="fill-destructive text-xs pointer-events-none">
                    X
                  </text>
                )}
                {name && !isDragging && (
                  <text
                    x={sx}
                    y={sy + 1}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-foreground text-xs pointer-events-none"
                    style={{ fill: getNameColor(name) }}
                  >
                    {name.length > 3 ? name.slice(0, 3) : name}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  return (
    <div
      onMouseUp={() => {
        handleDragEnd();
        seatDraggingRef.current = false;
      }}
      onMouseLeave={() => {
        handleDragEnd();
        seatDraggingRef.current = false;
      }}
    >
      <div className="flex flex-wrap items-start gap-2 sm:items-center sm:gap-3 mb-5 rounded-lg border border-border/60 bg-muted/20 p-3">
        <label className="flex w-full sm:w-auto items-center gap-2 text-sm text-muted-foreground">
          {t('seat.editor.common.name')}
          <Input
            type="text"
            value={recordName}
            onChange={e => setRecordName(e.target.value)}
            placeholder={t('seat.editor.common.namePlaceholder')}
            className="h-8 w-full sm:w-72"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {t('seat.editor.common.perTable')}
          <Input type="number" min={6} max={20} value={seatsPerTable}
            onChange={e => setSeatsPerTable(Math.max(6, Math.min(20, Number(e.target.value))))} className="w-16 h-8 text-center" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {t('seat.editor.common.rows')}
          <Input type="number" min={1} value={tableRows}
            onChange={e => handleRowsChange(e.target.value)} className="w-16 h-8 text-center" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {t('seat.editor.common.cols')}
          <Input type="number" min={1} value={tableCols}
            onChange={e => handleColsChange(e.target.value)} className="w-16 h-8 text-center" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {t('seat.editor.common.tables')}
          <Input type="number" min={1} value={tableCount}
            onChange={e => handleTableCountChange(e.target.value)} className="w-20 h-8 text-center" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {t('seat.editor.common.mode')}
          <select
            value={mode}
            onChange={e => setMode(e.target.value as BanquetSeatMode)}
            className="h-8 px-2 rounded-md border border-input bg-background text-foreground text-sm"
          >
            <option value="tableRoundRobin">{t('seat.editor.banquet.modeTableRoundRobin')}</option>
            <option value="tableGrouped">{t('seat.editor.banquet.modeTableGrouped')}</option>
            <option value="verticalS">{t('seat.editor.banquet.modeVerticalS')}</option>
            <option value="horizontalS">{t('seat.editor.banquet.modeHorizontalS')}</option>
            <option value="orgTableStage">{t('seat.editor.banquet.modeOrgTableStage')}</option>
          </select>
        </label>
        {mode === 'tableGrouped' && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            {t('seat.editor.common.groupCount')}
            <Input type="number" min={2} max={30} value={groupCount}
              onChange={e => setGroupCount(Math.max(2, Math.min(30, Number(e.target.value))))} className="w-16 h-8 text-center" />
          </label>
        )}
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {t('seat.editor.common.tableSpacing')}
          <Input type="number" min={0} max={100} value={tableGap}
            onChange={e => setTableGap(Math.max(0, Math.min(100, Number(e.target.value))))} className="w-16 h-8 text-center" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={showOrgColorMark}
            onChange={e => setShowOrgColorMark(e.target.checked)}
            className="accent-primary"
          />
          {t('seat.editor.common.orgColor')}
        </label>

        <div className="flex w-full sm:w-auto sm:min-w-[24rem] items-center gap-2 rounded-md border border-border/60 bg-background/80 px-2 py-1">
          <Button variant="outline" onClick={saveToHistory} className="gap-2 h-8" disabled={assignment.length === 0}>
            <Save className="w-4 h-4" /> {t('seat.editor.common.saveHistory')}
          </Button>
          <select
            value={selectedHistoryId}
            onChange={e => setSelectedHistoryId(e.target.value)}
            className="h-8 min-w-0 flex-1 sm:max-w-72 px-2 rounded-md border border-input bg-background text-foreground text-sm"
          >
            <option value="">{t('seat.editor.common.selectHistory')}</option>
            {historyItems.map(item => (
              <option key={item.id} value={item.id}>
                {item.name}（{new Date(item.createdAt).toLocaleString()}）
              </option>
            ))}
          </select>
          <Button variant="outline" onClick={restoreFromHistory} disabled={!selectedHistoryId} className="gap-2 h-8">
            <RotateCcw className="w-4 h-4" /> {t('seat.editor.common.restoreHistory')}
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={!selectedHistoryId}
            title={t('seat.editor.common.renameTitle')}
            onClick={async () => {
              const id = selectedHistoryId;
              const current = historyItems.find(h => h.id === id);
              if (!id || !current) return;
              const next = window.prompt(t('seat.editor.common.renamePrompt'), current.name)?.trim();
              if (!next || next === current.name) return;
              await renameCloudSeatHistory(id, next);
              renameSeatHistoryLocal('banquet', id, next);
              setHistoryItems(prev => prev.map(h => (h.id === id ? { ...h, name: next } : h)));
              toast.success(t('seat.editor.common.renamed'));
            }}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            disabled={!selectedHistoryId}
            title={t('seat.editor.common.deleteTitle')}
            onClick={async () => {
              const id = selectedHistoryId;
              if (!id) return;
              if (!window.confirm(t('seat.editor.common.deleteConfirm'))) return;
              await deleteCloudSeatHistory(id);
              deleteSeatHistoryLocal('banquet', id);
              setHistoryItems(prev => prev.filter(h => h.id !== id));
              setSelectedHistoryId('');
              toast.success(t('seat.editor.common.deleted'));
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
        <Button variant="outline" onClick={seatByLastGroups} className="gap-2">
          <Users className="w-4 h-4" /> {t('seat.editor.banquet.byGroupArrange')}
        </Button>

        <Button variant="outline" onClick={() => setRefPositions(defaultRefPositions)}>
          {t('seat.editor.banquet.resetMarkers')}
        </Button>
        <TitleRankConfigDialog
          value={titleRankRuleText}
          sceneLabel={t('seat.editor.scene.banquet')}
          onSave={next => {
            const saved = saveTitleRankRuleText(next, 'banquet');
            setTitleRankRuleText(saved);
          }}
        />

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={refVisible.screen} onChange={() => toggleRefVisible('screen')} className="accent-primary" /> {t('seat.editor.banquet.screen')}
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={refVisible.podium} onChange={() => toggleRefVisible('podium')} className="accent-primary" /> {t('seat.editor.banquet.tStage')}
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={refVisible.window} onChange={() => toggleRefVisible('window')} className="accent-primary" /> {t('seat.editor.common.window')}
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={refVisible.frontDoor} onChange={() => toggleRefVisible('frontDoor')} className="accent-primary" /> {t('seat.editor.common.frontDoor')}
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={refVisible.backDoor} onChange={() => toggleRefVisible('backDoor')} className="accent-primary" /> {t('seat.editor.common.backDoor')}
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={refLocked} onChange={e => setRefLocked(e.target.checked)} className="accent-primary" /> {t('seat.editor.banquet.lockMarkers')}
          </label>
        </div>

        <span className="text-xs text-muted-foreground">
          {tFormat(t('seat.editor.smart.capacityHint'), seatsPerTable * tableCount, students.length)}
        </span>

        {assignment.length > 0 && (
          <ExportButtons
            targetRef={printRef}
            filename={recordName.trim() || t('seat.editor.scene.banquetFile')}
            resolveQrCode={resolveQrCode}
            titleValue={recordName}
            onTitleChange={setRecordName}
            hideTitleInput
          />
        )}
        {assignment.length > 0 && (
          <Button variant="outline" onClick={() => setCheckinOpen(true)} className="gap-2">
            <QrCode className="w-4 h-4" /> {t('seat.editor.common.checkin')}
          </Button>
        )}
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" onClick={() => autoSeat(true)} className="gap-2">
            <Shuffle className="w-4 h-4" /> {t('seat.editor.common.randomSeat')}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (!window.confirm(t('seat.editor.common.clearConfirm'))) return;
              setAssignment(Array.from({ length: tableCount }, () => Array.from({ length: seatsPerTable }, () => '')));
            }}
            className="gap-2"
            title={t('seat.editor.common.clearTitle')}
          >
            <Trash2 className="w-4 h-4" /> {t('seat.editor.common.clear')}
          </Button>
          <Button onClick={() => autoSeat(false)} className="gap-2">
            <LayoutGrid className="w-4 h-4" /> {t('seat.editor.common.autoSeat')}
          </Button>
        </div>
      </div>

      <div ref={printRef}>

        {assignment.length > 0 ? (
          <div className="space-y-2">
            <div className="flex justify-end">
              <ZoomControls scale={zoom.scale} onZoomIn={zoom.zoomIn} onZoomOut={zoom.zoomOut} onFit={zoom.fitToScreen} onReset={zoom.reset} />
            </div>
            <div ref={zoom.containerRef} className="overflow-auto pb-[max(0.5rem,env(safe-area-inset-bottom))] max-h-[80vh]">
              <div className="mx-auto" style={{ width: roomWidth * zoom.scale, height: roomHeight * zoom.scale }}>
                <div className="relative rounded-xl border border-border bg-card/40" style={{ width: roomWidth, height: roomHeight, transform: `scale(${zoom.scale})`, transformOrigin: 'top left' }}>
              {refVisible.screen && (
                <div className={refBadgeClass} style={{ left: refPositions.screen.x, top: refPositions.screen.y }} onMouseDown={e => startRefDrag(e, 'screen')}>
                  <span className={refIconClass}>🖥️</span>
                  <span className={refTextClass}>{t('seat.editor.common.screen')}</span>
                </div>
              )}
              {hasTStage && (
                <>
                  <div
                    className="absolute rounded-xl border border-primary/35 bg-primary/12 shadow-sm pointer-events-none"
                    style={{
                      left: `calc(50% - ${tStageTopWidth / 2}px)`,
                      top: tStageTopY,
                      width: tStageTopWidth,
                      height: tStageTopHeight,
                    }}
                  />
                  <div
                    className="absolute rounded-xl border border-primary/35 bg-primary/12 shadow-sm pointer-events-none"
                    style={{
                      left: `calc(50% - ${tStageRunwayWidth / 2}px)`,
                      top: tStageRunwayTop,
                      width: tStageRunwayWidth,
                      height: tStageRunwayHeight,
                    }}
                  />
                  <div
                    className="absolute text-[11px] font-medium text-primary/80 select-none pointer-events-none"
                    style={{ left: '50%', top: tStageTopY + 6, transform: 'translateX(-50%)' }}
                  >
                    {t('seat.editor.banquet.tStage')}
                  </div>
                </>
              )}
              {refVisible.window && (
                <div className={refBadgeClass} style={{ left: refPositions.window.x, top: refPositions.window.y }} onMouseDown={e => startRefDrag(e, 'window')}>
                  <span className={refIconClass}>🪟</span>
                  <span className={refTextClass}>{t('seat.editor.common.window')}</span>
                </div>
              )}
              {refVisible.frontDoor && (
                <div className={refBadgeClass} style={{ left: refPositions.frontDoor.x, top: refPositions.frontDoor.y }} onMouseDown={e => startRefDrag(e, 'frontDoor')}>
                  <span className={refIconClass}>🚪</span>
                  <span className={refTextClass}>{t('seat.editor.common.frontDoor')}</span>
                </div>
              )}
              {refVisible.backDoor && (
                <div className={refBadgeClass} style={{ left: refPositions.backDoor.x, top: refPositions.backDoor.y }} onMouseDown={e => startRefDrag(e, 'backDoor')}>
                  <span className={refIconClass}>🚪</span>
                  <span className={refTextClass}>{t('seat.editor.common.backDoor')}</span>
                </div>
              )}

              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  className="inline-grid pointer-events-auto"
                  style={{
                    gridTemplateColumns: hasTStage && tableCols > 1
                      ? `repeat(${splitIndex}, ${tableCellSize}px) ${tStageRunwayWidth}px repeat(${tableCols - splitIndex}, ${tableCellSize}px)`
                      : `repeat(${tableCols}, ${tableCellSize}px)`,
                    columnGap: `${tableGap}px`,
                    rowGap: `${tableGap}px`,
                  }}
                >
                  {assignment.map((people, i) => {
                    const col = i % tableCols;
                    const row = Math.floor(i / tableCols);
                    const visualCol = hasTStage && tableCols > 1 && col >= splitIndex ? col + 2 : col + 1;
                    return (
                      <div key={`banquet-table-cell-${i}`} style={{ gridColumn: visualCol, gridRow: row + 1 }}>
                        {renderBanquetTable(i, people)}
                      </div>
                    );
                  })}
                </div>
              </div>
              </div>
            </div>
          </div>
        </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg mb-2">{t('seat.editor.banquet.startHint1')}</p>
            <p className="text-sm">{t('seat.editor.banquet.startHint2')}</p>
          </div>
        )}
      </div>

      {assignment.length > 0 && (
        <p className="text-center text-xs text-muted-foreground mt-4">
          {t('seat.editor.banquet.dragHint')}
        </p>
      )}
      <SeatCheckinDialog
        open={checkinOpen}
        onOpenChange={setCheckinOpen}
        seatData={assignment}
        studentNames={students.map(s => s.name)}
        sceneType="banquet"
        sceneConfig={exportSceneConfig}
        className={recordName.trim() || exportClassName}
        pngFileName={recordName.trim() || t('seat.editor.scene.banquetFile')}
        onSessionCreated={({ checkinUrl }) => handleSessionCreated(checkinUrl)}
      />
    </div>
  );
}
