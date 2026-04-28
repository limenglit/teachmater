import { useState, useRef, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowRightLeft } from 'lucide-react';
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
  loadSmartClassroomSnapshot,
  saveSmartClassroomSnapshot,
  groupsFromSeatAssignment,
  loadSmartClassroomHistory,
  saveSmartClassroomHistory,
  SmartClassroomHistoryItem,
  deleteSeatHistoryLocal,
  renameSeatHistoryLocal,
} from '@/lib/teamwork-local';
import { saveCloudSeatHistory, fetchCloudSeatHistory, migrateLocalToCloudOnce, deleteCloudSeatHistory, renameCloudSeatHistory } from '@/lib/seat-history-cloud';
import { useLanguage, tFormat } from '@/contexts/LanguageContext';

interface Props {
  students: { id: string; name: string; organization?: string; title?: string }[];
  frontDoorPosition?: 'top' | 'bottom' | 'left' | 'right';
  backDoorPosition?: 'top' | 'bottom' | 'left' | 'right';
  entryDoorMode?: 'front' | 'back' | 'both';
}

type SmartSeatMode = 'tableRoundRobin' | 'tableGrouped' | 'verticalS' | 'horizontalS' | 'orgTablePodium';
type RefKey = 'screen' | 'podium' | 'frontDoor' | 'backDoor' | 'window';
type RefPositions = Record<RefKey, { x: number; y: number }>;
type RefVisible = Record<RefKey, boolean>;

function getDefaultRefPositions(roomWidth: number, roomHeight: number): RefPositions {
  const badgeW = 94;
  const centeredX = Math.round((roomWidth - badgeW) / 2);
  const leftX = 8;
  const centerY = Math.max(20, Math.round((roomHeight - 32) / 2));
  const rightX = Math.max(24, roomWidth - badgeW - 24);
  return {
    screen: { x: centeredX, y: 22 },
    podium: { x: centeredX, y: 74 },
    frontDoor: { x: leftX, y: centerY - 48 },
    backDoor: { x: rightX, y: Math.max(160, roomHeight - 56) },
    window: { x: 24, y: centerY },
  };
}

export default function SmartClassroom({
  students,
  frontDoorPosition = 'right',
  backDoorPosition = 'left',
  entryDoorMode = 'front',
}: Props) {
  const { t } = useLanguage();
  // 门窗位置状态
  const [frontDoor, setFrontDoor] = useState<'top' | 'bottom' | 'left' | 'right'>(frontDoorPosition);
  // 保证后门与前门不重叠
  const [backDoor, setBackDoor] = useState<'top' | 'bottom' | 'left' | 'right'>(backDoorPosition === frontDoorPosition ? (backDoorPosition === 'right' ? 'left' : 'right') : backDoorPosition);
  // 窗户自动避开门
  const [windowPos, setWindowPos] = useState<'left' | 'right'>(frontDoorPosition === 'left' ? 'right' : 'left');
  const [entryDoor, setEntryDoor] = useState<'front' | 'back' | 'both'>(entryDoorMode);
  // 讲台彻底移除
  // const [showPodium, setShowPodium] = useState(false);
  const initialTableCount = Math.max(1, Math.ceil(students.length / 6));
  const initialTableCols = Math.max(1, Math.ceil(Math.sqrt(initialTableCount)));
  const initialTableRows = Math.max(1, Math.ceil(initialTableCount / initialTableCols));

  const [seatsPerTable, setSeatsPerTable] = useState(6);
  const [tableCols, setTableCols] = useState(initialTableCols);
  const [tableRows, setTableRows] = useState(initialTableRows);
  const [tableCount, setTableCount] = useState(initialTableCount);
  const [groupCount, setGroupCount] = useState(4);
  const [mode, setMode] = useState<SmartSeatMode>('orgTablePodium');
  const [assignment, setAssignment] = useState<string[][]>([]);
  const [closedSeats, setClosedSeats] = useState<Set<string>>(new Set());
  const [reservedTables, setReservedTables] = useState<Set<number>>(new Set());
  const [tableGap, setTableGap] = useState(20);
  const [tablePositions, setTablePositions] = useState<{ x: number; y: number }[]>([]);
  const [refPositions, setRefPositions] = useState<RefPositions>(() => getDefaultRefPositions(920, 640));
  const [refVisible, setRefVisible] = useState<RefVisible>({
    screen: true,
    podium: true,
    frontDoor: true,
    backDoor: true,
    window: true,
  });
  const [refLocked, setRefLocked] = useState(false);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [linkedGroupNames, setLinkedGroupNames] = useState<string[]>([]);
  const [recordName, setRecordName] = useState('');
  const [historyItems, setHistoryItems] = useState<SmartClassroomHistoryItem[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState('');
  const [titleRankRuleText, setTitleRankRuleText] = useState(() => loadTitleRankRuleText('smartClassroom'));
  const [showOrgColorMark, setShowOrgColorMark] = useState(true);

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

  const toggleRefVisible = (key: RefKey) => {
    setRefVisible(prev => ({ ...prev, [key]: !prev[key] }));
  };

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

  /** Return distance of a table to the "front" side based on frontDoor direction */
  const tableDistToFront = (tableIndex: number) => {
    const row = Math.floor(tableIndex / tableCols);
    const col = tableIndex % tableCols;
    if (frontDoor === 'top') return row;           // row 0 nearest
    if (frontDoor === 'bottom') return tableRows - 1 - row; // last row nearest
    if (frontDoor === 'left') return col;           // col 0 nearest
    /* right */ return tableCols - 1 - col;         // last col nearest
  };

  /** Return "lateral" position of a table (perpendicular to front direction) */
  const tableLateral = (tableIndex: number) => {
    const row = Math.floor(tableIndex / tableCols);
    const col = tableIndex % tableCols;
    // For top/bottom front, lateral = column; for left/right front, lateral = row
    return (frontDoor === 'top' || frontDoor === 'bottom') ? col : row;
  };

  const lateralCount = (frontDoor === 'top' || frontDoor === 'bottom') ? tableCols : tableRows;

  const getPodiumPriorityTableOrder = () => {
    const center = (lateralCount - 1) / 2;
    return Array.from({ length: tableCount }, (_, i) => i)
      .filter(index => !reservedTables.has(index))
      .sort((a, b) => {
        const distA = tableDistToFront(a);
        const distB = tableDistToFront(b);
        if (distA !== distB) return distA - distB;
        const latA = tableLateral(a);
        const latB = tableLateral(b);
        const centerDistA = Math.abs(latA - center);
        const centerDistB = Math.abs(latB - center);
        if (centerDistA !== centerDistB) return centerDistA - centerDistB;
        return latA - latB;
      });
  };

  const getSeatOrderNearPodium = () => {
    const radius = 52;
    return Array.from({ length: seatsPerTable }, (_, i) => i)
      .sort((a, b) => {
        const angleA = (2 * Math.PI * a) / seatsPerTable - Math.PI / 2;
        const angleB = (2 * Math.PI * b) / seatsPerTable - Math.PI / 2;
        // Determine which axis points toward the front
        let valA: number, valB: number;
        if (frontDoor === 'top') { valA = radius * Math.sin(angleA); valB = radius * Math.sin(angleB); } // top = smaller y
        else if (frontDoor === 'bottom') { valA = -radius * Math.sin(angleA); valB = -radius * Math.sin(angleB); }
        else if (frontDoor === 'left') { valA = radius * Math.cos(angleA); valB = radius * Math.cos(angleB); } // left = smaller x (cos < 0)
        else { valA = -radius * Math.cos(angleA); valB = -radius * Math.cos(angleB); } // right
        if (valA !== valB) return valA - valB;
        return Math.abs(Math.cos(angleA)) - Math.abs(Math.cos(angleB));
      });
  };

  const getColumnPriority = () => {
    const center = (lateralCount - 1) / 2;
    return Array.from({ length: lateralCount }, (_, i) => i)
      .sort((a, b) => {
        const da = Math.abs(a - center);
        const db = Math.abs(b - center);
        if (da !== db) return da - db;
        return a - b;
      });
  };

  const getColumnTablesNearPodium = () => {
    const map = new Map<number, number[]>();
    for (let lat = 0; lat < lateralCount; lat++) {
      const tablesInLane = Array.from({ length: tableCount }, (_, i) => i)
        .filter(index => !reservedTables.has(index) && tableLateral(index) === lat)
        .sort((a, b) => tableDistToFront(a) - tableDistToFront(b));
      map.set(lat, tablesInLane);
    }
    return map;
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

  const applyGroupsToSeat = (fromGroups: ReturnType<typeof loadLastGroups>) => {
    const availableNames = new Set(students.map(s => s.name));
    const filteredGroups = fromGroups
      .map(group => ({
        ...group,
        members: group.members.filter(member => availableNames.has(member.name)),
      }))
      .filter(group => group.members.length > 0);

    if (filteredGroups.length === 0) {
      toast.error(t('seat.editor.common.noGroupsFound'));
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
    setClosedSeats(new Set());
    setReservedTables(new Set());
    return true;
  };

  const getTableOrder = (seatMode: SmartSeatMode) => {
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

    if (mode === 'orgTablePodium' && !shuffle) {
      const seatOrder = getSeatOrderNearPodium();
      const columnPriority = getColumnPriority();
      const columnTables = getColumnTablesNearPodium();

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

      const getColumnRemain = (col: number) => {
        const tablesInCol = columnTables.get(col) || [];
        let remain = 0;
        for (const tableIndex of tablesInCol) {
          for (const seatIndex of seatOrder) {
            if (closedSeats.has(seatKey(tableIndex, seatIndex))) continue;
            if (!tables[tableIndex][seatIndex]) remain++;
          }
        }
        return remain;
      };

      const placeIntoColumn = (col: number, group: Array<{ name: string; score: number }>, startCursor: number) => {
        const tablesInCol = columnTables.get(col) || [];
        let cursor = startCursor;
        for (const tableIndex of tablesInCol) {
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

        // First pass: keep the unit in one column as much as possible.
        let primaryCol = columnPriority[0];
        let bestRemain = -1;
        columnPriority.forEach(col => {
          const remain = getColumnRemain(col);
          if (remain > bestRemain) {
            bestRemain = remain;
            primaryCol = col;
          }
        });

        cursor = placeIntoColumn(primaryCol, group, cursor);

        // Second pass: if overflow, spill to other columns in priority order.
        if (cursor < group.length) {
          columnPriority
            .filter(col => col !== primaryCol)
            .forEach(col => {
              if (cursor >= group.length) return;
              cursor = placeIntoColumn(col, group, cursor);
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

  const buildSnapshot = () => ({
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

  const saveToHistory = async () => {
    if (assignment.length === 0) {
      toast.error(t('seat.editor.common.noSeatsToSave'));
      return;
    }
    const name = recordName.trim() || `${t('seat.editor.scene.classroom')}-${new Date().toLocaleString()}`;
    const item = saveSmartClassroomHistory(name, buildSnapshot());
    let savedItem: SmartClassroomHistoryItem = item;
    const cloud = await saveCloudSeatHistory('smart_classroom', name, item.snapshot);
    if (cloud) savedItem = { id: cloud.id, name: cloud.name, createdAt: cloud.createdAt, snapshot: cloud.snapshot } as SmartClassroomHistoryItem;
    const nextItems = [savedItem, ...historyItems].slice(0, 50);
    setHistoryItems(nextItems);
    setSelectedHistoryId(savedItem.id);
    setRecordName(name);
    saveSmartClassroomSnapshot(item.snapshot);
    toast.success(cloud ? t('seat.editor.common.savedHistoryCloud') : t('seat.editor.common.savedHistoryLocal'));
  };

  const restoreFromHistory = () => {
    const item = historyItems.find(history => history.id === selectedHistoryId);
    if (!item) {
      toast.error(t('seat.editor.common.noHistorySelected'));
      return;
    }
    const snapshot = item.snapshot;
    const validStudentNames = new Set(students.map(s => s.name));
    const sanitizedAssignment = snapshot.assignment.map(table =>
      table.map(name => (validStudentNames.has(name) ? name : ''))
    );

    setSeatsPerTable(Math.max(3, snapshot.seatsPerTable));
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
    saveSmartClassroomSnapshot({ ...snapshot, assignment: sanitizedAssignment });
    toast.success(t('seat.editor.common.restoredHistory'));
  };

  const seatByLastGroups = () => {
    const cachedGroups = loadLastGroups();
    if (cachedGroups.length === 0) {
      toast.error(t('seat.editor.common.noGroups'));
      return;
    }
    const ok = applyGroupsToSeat(cachedGroups);
    if (ok) {
      toast.success(t('seat.editor.common.byGroupOneTableDone'));
    }
  };

  const roomWidth = Math.max(920, tableCols * 160 + Math.max(0, tableCols - 1) * tableGap + 220);
  const roomHeight = Math.max(640, tableRows * 160 + Math.max(0, tableRows - 1) * tableGap + 240);
  const zoom = useSceneZoom({ contentWidth: roomWidth, contentHeight: roomHeight });
  useZoomGestures({ setScale: zoom.setScale, targetRef: zoom.containerRef });
  const exportSceneConfig = {
    seatsPerTable, tableCount, tableCols, tableRows,
    frontDoorPosition: frontDoor,
    backDoorPosition: backDoor,
    entryDoorMode: entryDoor,
  };
  const { className: exportClassName, resolveQrCode, handleSessionCreated } = useSeatExportQr({
    seatData: assignment,
    studentNames: students.map(s => s.name),
    sceneConfig: exportSceneConfig,
    sceneType: 'smartClassroom',
  });
  const defaultRefPositions = useMemo(() => getDefaultRefPositions(roomWidth, roomHeight), [roomWidth, roomHeight]);
  const refBadgeClass = 'absolute h-8 pl-2 pr-2.5 rounded-lg border border-primary/30 bg-primary/10 text-primary shadow-sm cursor-move select-none inline-flex items-center gap-1.5';
  const refIconClass = 'inline-flex items-center justify-center w-5 h-5 rounded-md border border-primary/30 bg-background/80 text-[11px] leading-none';
  const refTextClass = 'text-[11px] font-medium leading-none tracking-wide';

  useEffect(() => {
    const requiredTableCount = Math.max(1, Math.ceil(students.length / Math.max(1, seatsPerTable)));
    if (requiredTableCount <= tableCount) return;
    setTableCount(requiredTableCount);
    setTableRows(Math.max(1, Math.ceil(requiredTableCount / tableCols)));
  }, [students.length, seatsPerTable, tableCols, tableCount]);

  useEffect(() => {
    setRefPositions(defaultRefPositions);
  }, [defaultRefPositions]);

  useEffect(() => {
    setTablePositions(Array(tableCount).fill({ x: 0, y: 0 }));
  }, [tableCount]);

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
    setHistoryItems(loadSmartClassroomHistory());
    (async () => {
      await migrateLocalToCloudOnce('smart_classroom');
      const cloud = await fetchCloudSeatHistory<SmartClassroomHistoryItem['snapshot']>('smart_classroom');
      if (cloud) setHistoryItems(cloud.map(r => ({ id: r.id, name: r.name, createdAt: r.createdAt, snapshot: r.snapshot })) as SmartClassroomHistoryItem[]);
    })();
  }, []);

  useEffect(() => {
    if (restoredOnceRef.current) return;
    const snapshot = loadSmartClassroomSnapshot();
    let valid = false;
    if (snapshot && Array.isArray(snapshot.assignment) && snapshot.assignment.length > 0) {
      const validStudentNames = new Set(students.map(s => s.name));
      const sanitizedAssignment = snapshot.assignment.map(table =>
        table.map(name => (validStudentNames.has(name) ? name : ''))
      );
      setSeatsPerTable(Math.max(3, snapshot.seatsPerTable));
      setTableCount(Math.max(1, snapshot.tableCount));
      setTableCols(Math.max(1, snapshot.tableCols));
      setTableRows(Math.max(1, snapshot.tableRows));
      setGroupCount(Math.max(1, snapshot.groupCount));
      setMode(snapshot.mode);
      setTableGap(Math.max(0, snapshot.tableGap));
      setAssignment(sanitizedAssignment);
      setClosedSeats(new Set(snapshot.closedSeats || []));
      setReservedTables(new Set(snapshot.reservedTables || []));
      valid = true;
    }
    if (!valid) {
      // 快照损坏或无效，自动清空并恢复初始状态
      setAssignment([]);
      setClosedSeats(new Set());
      setReservedTables(new Set());
      localStorage.removeItem('smartClassroomSnapshot');
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

    saveSmartClassroomSnapshot({
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
  }, [assignment, seatsPerTable, tableCount, tableCols, tableRows, groupCount, mode, tableGap, closedSeats, reservedTables, linkedGroupNames]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingRef.current) {
        const dx = e.clientX - draggingRef.current.startX;
        const dy = e.clientY - draggingRef.current.startY;
        setTablePositions(pos => pos.map((p, i) =>
          i === draggingRef.current!.index
            ? { x: draggingRef.current!.origX + dx, y: draggingRef.current!.origY + dy }
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
  }, []);

  const startTableDrag = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    if (seatDraggingRef.current) return;
    draggingRef.current = {
      index,
      startX: e.clientX,
      startY: e.clientY,
      origX: tablePositions[index]?.x || 0,
      origY: tablePositions[index]?.y || 0,
    };
  };

  const startRefDrag = (e: React.MouseEvent, key: RefKey) => {
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

  const renderRoundTable = (tableIndex: number, people: string[]) => {
    const radius = 52;
    const seatRadius = 16;
    const cx = 80;
    const cy = 80;
    const totalSlots = seatsPerTable;
    const pos = tablePositions[tableIndex] || { x: 0, y: 0 };
    const isReservedTable = reservedTables.has(tableIndex);

    return (
      <div
        key={tableIndex}
        className="flex flex-col items-center gap-1 cursor-move"
        style={{ transform: `translate(${pos.x}px,${pos.y}px)` }}
        onMouseDown={e => startTableDrag(e, tableIndex)}
      >
        <svg width={160} height={160} viewBox="0 0 160 160" className="font-sans" style={{ fontFamily: 'var(--font-family)' }}>
          <g
            onMouseDown={e => {
              e.preventDefault();
              e.stopPropagation();
              toggleTableReserved(tableIndex);
            }}
            style={{ cursor: 'pointer' }}
          >
            <circle
              cx={cx}
              cy={cy}
              r={36}
              className={isReservedTable ? 'fill-amber-100 stroke-amber-500' : 'fill-primary/10 stroke-primary/30'}
              strokeWidth={2}
            />
            <text x={cx} y={cy - 8} textAnchor="middle" dominantBaseline="middle" className={isReservedTable ? 'fill-amber-700 text-[10px] font-semibold' : 'fill-primary text-[10px] font-medium'}>
              {tFormat(t('seat.editor.smart.tableNum'), tableIndex + 1)}
            </text>
            <text x={cx} y={cy + 8} textAnchor="middle" dominantBaseline="middle" className={isReservedTable ? 'fill-amber-700 text-xs font-semibold' : 'fill-muted-foreground text-[10px]'}>
              {isReservedTable ? t('seat.editor.common.reserved') : t('seat.editor.common.open')}
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
            return (
              <g
                key={i}
                style={{ cursor: name && !isClosed ? 'grab' : 'pointer' }}
                onMouseDown={name && !isClosed ? (e) => {
                  if (isReservedTable) return;
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
                onClick={() => { if (!name && !isReservedTable) toggleSeatOpen(tableIndex, i); }}
              >
                <circle
                  cx={sx} cy={sy} r={seatRadius}
                  className={
                    isReservedTable ? 'fill-amber-50 stroke-amber-200' :
                    isClosed ? 'fill-muted stroke-destructive/60' :
                    isDragging ? 'fill-primary/20 stroke-primary' :
                    isOver ? 'fill-accent stroke-primary' :
                    name ? 'fill-card stroke-border hover:stroke-primary/50' : 'fill-muted/50 stroke-border/50'
                  }
                  strokeWidth={isOver ? 2.5 : 1.5}
                  style={{ transition: 'all 0.15s' }}
                />
                {isClosed && (
                  <text x={sx} y={sy + 1} textAnchor="middle" dominantBaseline="middle" className="fill-destructive text-xs pointer-events-none">
                    {t('seat.editor.common.off')}
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
        refDraggingRef.current = null;
      }}
      onMouseLeave={() => {
        handleDragEnd();
        seatDraggingRef.current = false;
        refDraggingRef.current = null;
      }}
    >
      {/* 结构设置分区 */}
      <div className="flex flex-wrap items-start gap-2 sm:items-center sm:gap-3 mb-5 rounded-lg border border-border/60 bg-muted/20 p-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {t('seat.editor.common.frontDoor')}
          <select
            value={frontDoor}
            onChange={e => {
              const val = e.target.value as any;
              setFrontDoor(val);
              if (val === backDoor) setBackDoor(val === 'right' ? 'left' : 'right');
              if (val === windowPos) setWindowPos(val === 'left' ? 'right' : 'left');
            }}
            className="h-8 px-2 rounded-md border border-input bg-background text-foreground text-sm"
          >
            <option value="top">{t('seat.editor.common.topSide')}</option>
            <option value="bottom">{t('seat.editor.common.bottomSide')}</option>
            <option value="left">{t('seat.editor.common.leftSide')}</option>
            <option value="right">{t('seat.editor.common.rightSide')}</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {t('seat.editor.common.backDoor')}
          <select
            value={backDoor}
            onChange={e => {
              const val = e.target.value as any;
              setBackDoor(val);
              if (val === frontDoor) setFrontDoor(val === 'right' ? 'left' : 'right');
              if (val === windowPos) setWindowPos(val === 'left' ? 'right' : 'left');
            }}
            className="h-8 px-2 rounded-md border border-input bg-background text-foreground text-sm"
          >
            <option value="top">{t('seat.editor.common.topSide')}</option>
            <option value="bottom">{t('seat.editor.common.bottomSide')}</option>
            <option value="left">{t('seat.editor.common.leftSide')}</option>
            <option value="right">{t('seat.editor.common.rightSide')}</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {t('seat.editor.smart.entryDoor')}
          <select
            value={entryDoor}
            onChange={e => setEntryDoor(e.target.value as any)}
            className="h-8 px-2 rounded-md border border-input bg-background text-foreground text-sm"
          >
            <option value="front">{t('seat.editor.smart.entryFront')}</option>
            <option value="back">{t('seat.editor.smart.entryBack')}</option>
            <option value="both">{t('seat.editor.smart.entryBoth')}</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {t('seat.editor.smart.windowSide')}
          <select
            value={windowPos}
            onChange={e => setWindowPos(e.target.value as any)}
            className="h-8 px-2 rounded-md border border-input bg-background text-foreground text-sm"
          >
            <option value="left">{t('seat.editor.common.leftSide')}</option>
            <option value="right">{t('seat.editor.common.rightSide')}</option>
          </select>
        </label>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-card/60 p-4">
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
          <Input type="number" min={3} max={12} value={seatsPerTable}
            onChange={e => setSeatsPerTable(Math.max(3, Math.min(12, Number(e.target.value))))} className="w-16 h-8 text-center" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {t('seat.editor.common.rows')}
          <Input
            type="number"
            min={1}
            value={tableRows}
            onChange={e => handleRowsChange(e.target.value)}
            className="w-16 h-8 text-center"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {t('seat.editor.common.cols')}
          <Input
            type="number"
            min={1}
            value={tableCols}
            onChange={e => handleColsChange(e.target.value)}
            className="w-16 h-8 text-center"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {t('seat.editor.common.tables')}
          <Input
            type="number"
            min={1}
            value={tableCount}
            onChange={e => handleTableCountChange(e.target.value)}
            className="w-20 h-8 text-center"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {t('seat.editor.common.mode')}
          <select
            value={mode}
            onChange={e => setMode(e.target.value as SmartSeatMode)}
            className="h-8 px-2 rounded-md border border-input bg-background text-foreground text-sm"
          >
            <option value="tableRoundRobin">{t('seat.editor.common.modeTableRoundRobin')}</option>
            <option value="tableGrouped">{t('seat.editor.common.modeTableGrouped')}</option>
            <option value="verticalS">{t('seat.editor.common.modeVerticalSTable')}</option>
            <option value="horizontalS">{t('seat.editor.common.modeHorizontalSTable')}</option>
            <option value="orgTablePodium">{t('seat.editor.common.modeOrgTablePodium')}</option>
          </select>
        </label>
        {mode === 'tableGrouped' && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            {t('seat.editor.common.groupCount')}
            <Input type="number" min={2} max={20} value={groupCount}
              onChange={e => setGroupCount(Math.max(2, Math.min(20, Number(e.target.value))))} className="w-16 h-8 text-center" />
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
          <Button
            variant="outline"
            onClick={restoreFromHistory}
            disabled={!selectedHistoryId}
            className="gap-2 h-8"
          >
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
              renameSeatHistoryLocal('smart_classroom', id, next);
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
              deleteSeatHistoryLocal('smart_classroom', id);
              setHistoryItems(prev => prev.filter(h => h.id !== id));
              setSelectedHistoryId('');
              toast.success(t('seat.editor.common.deleted'));
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
        <Button variant="outline" onClick={seatByLastGroups} className="gap-2">
          <Users className="w-4 h-4" /> {t('seat.editor.common.byGroupOneTable')}
        </Button>
        <Button variant="outline" onClick={() => setRefPositions(defaultRefPositions)}>
          {t('seat.editor.common.resetReferences')}
        </Button>
        <TitleRankConfigDialog
          value={titleRankRuleText}
          sceneLabel={t('seat.editor.scene.classroom')}
          onSave={next => {
            const saved = saveTitleRankRuleText(next, 'smartClassroom');
            setTitleRankRuleText(saved);
          }}
        />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={refVisible.screen} onChange={() => toggleRefVisible('screen')} className="accent-primary" /> {t('seat.editor.common.screen')}
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={refVisible.podium} onChange={() => toggleRefVisible('podium')} className="accent-primary" /> {t('seat.editor.common.podium')}
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={refVisible.frontDoor} onChange={() => toggleRefVisible('frontDoor')} className="accent-primary" /> {t('seat.editor.common.frontDoor')}
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={refVisible.backDoor} onChange={() => toggleRefVisible('backDoor')} className="accent-primary" /> {t('seat.editor.common.backDoor')}
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={refVisible.window} onChange={() => toggleRefVisible('window')} className="accent-primary" /> {t('seat.editor.common.window')}
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={refLocked} onChange={e => setRefLocked(e.target.checked)} className="accent-primary" /> {t('seat.editor.common.lockReferences')}
          </label>
        </div>
        <span className="text-xs text-muted-foreground">
          容量 {seatsPerTable * tableCount} | 学生 {students.length}
        </span>
        {assignment.length > 0 && (
          <ExportButtons
            targetRef={printRef}
            filename={recordName.trim() || t('seat.editor.scene.classroomFile')}
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
                <div
                  className="relative rounded-xl border border-border bg-card/40"
                  style={{ width: roomWidth, height: roomHeight, transform: `scale(${zoom.scale})`, transformOrigin: 'top left' }}
                >
              {refVisible.screen && (
                <div
                  className={refBadgeClass}
                  style={{ left: refPositions.screen.x, top: refPositions.screen.y }}
                  onMouseDown={e => startRefDrag(e, 'screen')}
                >
                  <span className={refIconClass}>🖥️</span>
                  <span className={refTextClass}>{t('seat.editor.common.screen')}</span>
                </div>
              )}

              {refVisible.podium && (
                <div
                  className={refBadgeClass}
                  style={{ left: refPositions.podium.x, top: refPositions.podium.y }}
                  onMouseDown={e => startRefDrag(e, 'podium')}
                >
                  <span className={refIconClass}>🎤</span>
                  <span className={refTextClass}>{t('seat.editor.common.podium')}</span>
                </div>
              )}



              {/* 前门渲染 */}
              {refVisible.frontDoor && (() => {
                let style: React.CSSProperties = {};
                if (frontDoor === 'top') style = { left: Math.round(roomWidth / 2 - 47), top: 8 };
                if (frontDoor === 'bottom') style = { left: Math.round(roomWidth / 2 - 47), top: roomHeight - 32 };
                if (frontDoor === 'left') style = { left: 8, top: Math.round(roomHeight / 2 - 48) };
                if (frontDoor === 'right') style = { left: roomWidth - 94 - 8, top: Math.round(roomHeight / 2 - 48) };
                // 高亮可入场门
                const highlight = entryDoor === 'front' || entryDoor === 'both';
                return (
                  <div
                    className={refBadgeClass + (highlight ? ' ring-4 ring-green-400/80 ring-offset-2 animate-pulse' : '')}
                    style={{...style, zIndex: 10, background: 'linear-gradient(90deg,#e0ffe0 0%,#fff 100%)'}}
                    onMouseDown={e => startRefDrag(e, 'frontDoor')}
                    title={highlight ? t('seat.editor.common.entryHint') : undefined}
                  >
                    <span className={refIconClass + ' text-green-700 bg-green-100'}>🚪</span>
                    <span className={refTextClass + ' font-bold'}>{t('seat.editor.common.frontDoor')}</span>
                  </div>
                );
              })()}

              {/* 后门渲染 */}
              {refVisible.backDoor && (() => {
                let style: React.CSSProperties = {};
                if (backDoor === 'top') style = { left: Math.round(roomWidth / 2 - 47), top: 8 };
                if (backDoor === 'bottom') style = { left: Math.round(roomWidth / 2 - 47), top: roomHeight - 32 };
                if (backDoor === 'left') style = { left: 8, top: Math.round(roomHeight / 2 + 48) };
                if (backDoor === 'right') style = { left: roomWidth - 94 - 8, top: Math.round(roomHeight / 2 + 48) };
                // 高亮可入场门
                const highlight = entryDoor === 'back' || entryDoor === 'both';
                return (
                  <div
                    className={refBadgeClass + (highlight ? ' ring-4 ring-green-400/80 ring-offset-2 animate-pulse' : '')}
                    style={{...style, zIndex: 10, background: 'linear-gradient(90deg,#e0ffe0 0%,#fff 100%)'}}
                    onMouseDown={e => startRefDrag(e, 'backDoor')}
                    title={highlight ? t('seat.editor.common.entryHint') : undefined}
                  >
                    <span className={refIconClass + ' text-green-700 bg-green-100'}>🚪</span>
                    <span className={refTextClass + ' font-bold'}>{t('seat.editor.common.backDoor')}</span>
                  </div>
                );
              })()}

              {refVisible.window && (() => {
                let style: React.CSSProperties = {};
                if (windowPos === 'left') style = { left: 8, top: Math.round(roomHeight / 2 - 16) };
                if (windowPos === 'right') style = { left: roomWidth - 94 - 8, top: Math.round(roomHeight / 2 - 16) };
                return (
                  <div
                    className={refBadgeClass + ' bg-blue-50/80'}
                    style={{...style, zIndex: 9}}
                    onMouseDown={e => startRefDrag(e, 'window')}
                  >
                    <span className={refIconClass + ' text-blue-700 bg-blue-100'}>🪟</span>
                    <span className={refTextClass + ' font-bold'}>{t('seat.editor.common.window')}</span>
                  </div>
                );
              })()}

              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="inline-grid pointer-events-auto" style={{ gridTemplateColumns: `repeat(${tableCols}, 1fr)`, gap: `${tableGap}px` }}>
                  {assignment.map((people, i) => renderRoundTable(i, people))}
                </div>
              </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg mb-2">{t('seat.editor.common.clickAutoToStart')}</p>
            <p className="text-sm">圆形桌智能教室，每桌 {seatsPerTable} 人，共 {tableCount} 桌（{tableRows} 行 × {tableCols} 列）</p>
          </div>
        )}
      </div>

      {assignment.length > 0 && (
        <p className="text-center text-xs text-muted-foreground mt-4">
          点击桌心可切换保留/开放；保留桌自动排座时不安排学生；拖拽姓名可交换座位；点击空座位可关闭/开放使用；幕布/讲台/前后门/窗支持显隐与拖拽
        </p>
      )}
      <SeatCheckinDialog
        open={checkinOpen}
        onOpenChange={setCheckinOpen}
        seatData={assignment}
        studentNames={students.map(s => s.name)}
        sceneType="smartClassroom"
        sceneConfig={exportSceneConfig}
        className={recordName.trim() || exportClassName}
        pngFileName={recordName.trim() || t('seat.editor.scene.classroomFile')}
        onSessionCreated={({ checkinUrl }) => handleSessionCreated(checkinUrl)}
      />
    </div>
  );
}

