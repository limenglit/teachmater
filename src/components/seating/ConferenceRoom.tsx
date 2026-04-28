import { useState, useRef, useEffect, useMemo, type MouseEvent as ReactMouseEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LayoutGrid, Shuffle, QrCode, Save, RotateCcw, Trash2, Pencil } from 'lucide-react';
import ExportButtons from '@/components/ExportButtons';
import SeatCheckinDialog from '@/components/SeatCheckinDialog';
import TitleRankConfigDialog from './TitleRankConfigDialog';
import { useSeatExportQr } from './useSeatExportQr';
import ZoomControls, { useSceneZoom, useZoomGestures } from './ZoomControls';
import { toast } from 'sonner';
import { buildOrganizationColorResolver } from '@/lib/org-color';
import { buildTitleScorer, loadTitleRankRuleText, saveTitleRankRuleText } from '@/lib/title-rank';
import {
  loadConferenceRoomSnapshot,
  saveConferenceRoomSnapshot,
  loadConferenceRoomHistory,
  saveConferenceRoomHistory,
  type ConferenceRoomAssignment,
  type ConferenceRoomHistoryItem,
  deleteSeatHistoryLocal,
  renameSeatHistoryLocal,
} from '@/lib/teamwork-local';
import { saveCloudSeatHistory, fetchCloudSeatHistory, migrateLocalToCloudOnce, deleteCloudSeatHistory, renameCloudSeatHistory } from '@/lib/seat-history-cloud';
import { useLanguage, tFormat } from '@/contexts/LanguageContext';

interface Props {
  students: { id: string; name: string; organization?: string; title?: string }[];
}

type ConferenceSeatMode = 'balanced' | 'groupCluster' | 'verticalS' | 'horizontalS' | 'orgSideRankCenter';
type RefKey = 'screen' | 'podium' | 'window' | 'frontDoor' | 'backDoor';
type RefPositions = Record<RefKey, { x: number; y: number }>;
type RefVisible = Record<RefKey, boolean>;

function splitIntoGroups(names: string[], count: number) {
  const groups: string[][] = Array.from({ length: count }, () => []);
  names.forEach((n, i) => groups[i % count].push(n));
  return groups;
}

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
    backDoor: { x: rightX, y: Math.max(160, roomHeight - 56) },
  };
}

export default function ConferenceRoom({ students }: Props) {
  const { t } = useLanguage();
  const [seatsPerSide, setSeatsPerSide] = useState(10);
  const [groupCount, setGroupCount] = useState(4);
  const [mode, setMode] = useState<ConferenceSeatMode>('orgSideRankCenter');
  const [seatGap, setSeatGap] = useState(6);
  const [showCompanionSeats, setShowCompanionSeats] = useState(true);
  const [companionRows, setCompanionRows] = useState(1);
  const [assignment, setAssignment] = useState<ConferenceRoomAssignment>({
    headLeft: '',
    headRight: '',
    mainTop: Array.from({ length: 10 }, () => ''),
    mainBottom: Array.from({ length: 10 }, () => ''),
    companionTop: [Array.from({ length: 10 }, () => '')],
    companionBottom: [Array.from({ length: 10 }, () => '')],
  });
  const [closedSeats, setClosedSeats] = useState<Set<string>>(new Set());
  const [recordName, setRecordName] = useState('');
  const [historyItems, setHistoryItems] = useState<ConferenceRoomHistoryItem[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState('');
  const [titleRankRuleText, setTitleRankRuleText] = useState(() => loadTitleRankRuleText('conference'));
  const [showOrgColorMark, setShowOrgColorMark] = useState(true);
  const [dragFrom, setDragFrom] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [seated, setSeated] = useState(false);
  const [checkinOpen, setCheckinOpen] = useState(false);

  const [refVisible, setRefVisible] = useState<RefVisible>({
    screen: true,
    podium: true,
    window: true,
    frontDoor: true,
    backDoor: true,
  });
  const [refLocked, setRefLocked] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);
  const refDraggingRef = useRef<{ key: RefKey; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const restoredOnceRef = useRef(false);

  const seatW = 64;
  const seatH = 40;
  const gap = seatGap;
  const tableH = 64;
  const tableW = seatsPerSide * (seatW + gap) + gap;
  const headGap = 12;
  const sideGap = 10;

  const contentWidth = tableW + 2 * (seatW + headGap);
  const contentHeight =
    tableH +
    2 * (seatH + sideGap) +
    (showCompanionSeats ? 2 * companionRows * (seatH + sideGap) : 0);

  const roomWidth = Math.max(920, contentWidth + 160);
  const roomHeight = Math.max(640, contentHeight + 220);
  const zoom = useSceneZoom({ contentWidth: roomWidth, contentHeight: roomHeight });
  useZoomGestures({ setScale: zoom.setScale, targetRef: zoom.containerRef });
  const tableX = (roomWidth - tableW) / 2;
  const tableY = (roomHeight - tableH) / 2;

  const defaultRefPositions = useMemo(
    () => buildDefaultRefPositions(roomWidth, roomHeight),
    [roomWidth, roomHeight]
  );

  const [refPositions, setRefPositions] = useState<RefPositions>(() =>
    buildDefaultRefPositions(920, 640)
  );

  const exportSceneConfig = {
    seatsPerSide,
    companionRows: showCompanionSeats ? companionRows : 0,
    roomWidth,
    roomHeight,
    frontDoor: refVisible.frontDoor ? refPositions.frontDoor : null,
    backDoor: refVisible.backDoor ? refPositions.backDoor : null,
  };
  const { className: exportClassName, resolveQrCode, handleSessionCreated } = useSeatExportQr({
    seatData: assignment,
    studentNames: students.map(s => s.name),
    seatAssignmentReady: seated,
    sceneConfig: exportSceneConfig,
    sceneType: 'conference',
  });

  const refBadgeClass =
    'absolute h-8 pl-2 pr-2.5 rounded-lg border border-primary/30 bg-primary/10 text-primary shadow-sm cursor-move select-none inline-flex items-center gap-1.5';
  const refIconClass =
    'inline-flex items-center justify-center w-5 h-5 rounded-md border border-primary/30 bg-background/80 text-[11px] leading-none';
  const refTextClass = 'text-[11px] font-medium leading-none tracking-wide';

  const sideOrderSlots = useMemo(() => {
    const slots: { side: 'top' | 'bottom'; index: number }[] = [];

    if (mode === 'verticalS') {
      for (let c = 0; c < seatsPerSide; c++) {
        if (c % 2 === 0) {
          slots.push({ side: 'top', index: c });
          slots.push({ side: 'bottom', index: c });
        } else {
          slots.push({ side: 'bottom', index: c });
          slots.push({ side: 'top', index: c });
        }
      }
      return slots;
    }

    if (mode === 'horizontalS' || mode === 'groupCluster') {
      for (let c = 0; c < seatsPerSide; c++) slots.push({ side: 'top', index: c });
      for (let c = seatsPerSide - 1; c >= 0; c--) slots.push({ side: 'bottom', index: c });
      return slots;
    }

    for (let c = 0; c < seatsPerSide; c++) slots.push({ side: 'top', index: c });
    for (let c = 0; c < seatsPerSide; c++) slots.push({ side: 'bottom', index: c });
    return slots;
  }, [mode, seatsPerSide]);

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

  const getCenterOutIndexes = (size: number) => {
    const indexes: number[] = [];
    if (size <= 0) return indexes;
    const leftCenter = Math.floor((size - 1) / 2);
    const rightCenter = Math.ceil((size - 1) / 2);
    indexes.push(leftCenter);
    if (rightCenter !== leftCenter) indexes.push(rightCenter);
    for (let offset = 1; indexes.length < size; offset++) {
      const left = leftCenter - offset;
      const right = rightCenter + offset;
      if (left >= 0) indexes.push(left);
      if (right < size) indexes.push(right);
    }
    return indexes;
  };

  const getSidePrioritySlots = (side: 'top' | 'bottom', availableSlots: string[]) => {
    const sideSlots = new Set(
      availableSlots.filter(slot => slot.startsWith(`main-${side}-`) || slot.startsWith(`companion-${side}-`))
    );

    const prioritized: string[] = [];
    const centeredMain = getCenterOutIndexes(seatsPerSide).map(index => `main-${side}-${index}`);
    centeredMain.forEach(slot => {
      if (sideSlots.has(slot)) prioritized.push(slot);
    });

    if (showCompanionSeats) {
      for (let row = 0; row < companionRows; row++) {
        const centeredCompanion = getCenterOutIndexes(seatsPerSide).map(index => `companion-${side}-${row}-${index}`);
        centeredCompanion.forEach(slot => {
          if (sideSlots.has(slot)) prioritized.push(slot);
        });
      }
    }

    return prioritized;
  };

  const allSlots = useMemo(() => {
    const slots: string[] = ['head-left', 'head-right'];

    sideOrderSlots.forEach(({ side, index }) => {
      slots.push(`main-${side}-${index}`);
    });

    if (showCompanionSeats) {
      for (let r = 0; r < companionRows; r++) {
        sideOrderSlots.forEach(({ side, index }) => {
          slots.push(`companion-${side}-${r}-${index}`);
        });
      }
    }

    return slots;
  }, [companionRows, showCompanionSeats, sideOrderSlots]);

  useEffect(() => {
    setRefPositions(defaultRefPositions);
  }, [defaultRefPositions]);

  useEffect(() => {
    setAssignment(prev => ({
      headLeft: prev.headLeft,
      headRight: prev.headRight,
      mainTop: Array.from({ length: seatsPerSide }, (_, i) => prev.mainTop[i] || ''),
      mainBottom: Array.from({ length: seatsPerSide }, (_, i) => prev.mainBottom[i] || ''),
      companionTop: Array.from({ length: companionRows }, (_, r) =>
        Array.from({ length: seatsPerSide }, (_, i) => prev.companionTop[r]?.[i] || '')
      ),
      companionBottom: Array.from({ length: companionRows }, (_, r) =>
        Array.from({ length: seatsPerSide }, (_, i) => prev.companionBottom[r]?.[i] || '')
      ),
    }));
  }, [seatsPerSide, companionRows]);

  useEffect(() => {
    setClosedSeats(prev => {
      const next = new Set<string>();
      allSlots.forEach(slot => {
        if (prev.has(slot)) next.add(slot);
      });
      return next;
    });
  }, [allSlots]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!refDraggingRef.current) return;
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
    };

    const handleMouseUp = () => {
      refDraggingRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

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

  const getSeatValue = (data: ConferenceRoomAssignment, slot: string) => {
    if (slot === 'head-left') return data.headLeft;
    if (slot === 'head-right') return data.headRight;

    const parts = slot.split('-');
    if (parts[0] === 'main') {
      const side = parts[1] as 'top' | 'bottom';
      const index = Number(parts[2]);
      return side === 'top' ? data.mainTop[index] || '' : data.mainBottom[index] || '';
    }

    const side = parts[1] as 'top' | 'bottom';
    const row = Number(parts[2]);
    const index = Number(parts[3]);
    return side === 'top'
      ? data.companionTop[row]?.[index] || ''
      : data.companionBottom[row]?.[index] || '';
  };

  const setSeatValue = (data: ConferenceRoomAssignment, slot: string, value: string) => {
    if (slot === 'head-left') {
      data.headLeft = value;
      return;
    }
    if (slot === 'head-right') {
      data.headRight = value;
      return;
    }

    const parts = slot.split('-');
    if (parts[0] === 'main') {
      const side = parts[1] as 'top' | 'bottom';
      const index = Number(parts[2]);
      if (side === 'top') data.mainTop[index] = value;
      else data.mainBottom[index] = value;
      return;
    }

    const side = parts[1] as 'top' | 'bottom';
    const row = Number(parts[2]);
    const index = Number(parts[3]);
    if (side === 'top') data.companionTop[row][index] = value;
    else data.companionBottom[row][index] = value;
  };

  const toggleSeatOpen = (slot: string) => {
    setClosedSeats(prev => {
      const next = new Set(prev);
      if (next.has(slot)) next.delete(slot);
      else next.add(slot);
      return next;
    });
  };

  const autoSeat = (shuffle = false) => {
    const names = shuffle
      ? [...students.map(s => s.name)].sort(() => Math.random() - 0.5)
      : students.map(s => s.name);

    const next: ConferenceRoomAssignment = {
      headLeft: '',
      headRight: '',
      mainTop: Array.from({ length: seatsPerSide }, () => ''),
      mainBottom: Array.from({ length: seatsPerSide }, () => ''),
      companionTop: Array.from({ length: companionRows }, () => Array.from({ length: seatsPerSide }, () => '')),
      companionBottom: Array.from({ length: companionRows }, () => Array.from({ length: seatsPerSide }, () => '')),
    };

    const availableSlots = allSlots.filter(slot => !closedSeats.has(slot));

    if (mode === 'orgSideRankCenter' && !shuffle) {
      const topSlots = getSidePrioritySlots('top', availableSlots);
      const bottomSlots = getSidePrioritySlots('bottom', availableSlots);
      const neutralSlots = availableSlots.filter(slot => !topSlots.includes(slot) && !bottomSlots.includes(slot));

      const groupsMap = new Map<string, Array<{ name: string; score: number }>>();
      students.forEach(student => {
        const org = student.organization?.trim() || t('seat.editor.common.unassignedOrg');
        const item = { name: student.name, score: scoreTitle(student.title) };
        const bucket = groupsMap.get(org);
        if (bucket) bucket.push(item);
        else groupsMap.set(org, [item]);
      });

      const groups = Array.from(groupsMap.values())
        .map(items => items.sort((a, b) => b.score - a.score).map(item => item.name))
        .sort((a, b) => b.length - a.length);

      const topQueue: string[] = [];
      const bottomQueue: string[] = [];

      let topRemain = topSlots.length;
      let bottomRemain = bottomSlots.length;

      groups.forEach((group, idx) => {
        const preferTop = topRemain === bottomRemain ? idx % 2 === 0 : topRemain > bottomRemain;
        const target = preferTop ? topQueue : bottomQueue;
        const fallback = preferTop ? bottomQueue : topQueue;
        const targetRemain = preferTop ? topRemain : bottomRemain;
        const fallbackRemain = preferTop ? bottomRemain : topRemain;

        if (group.length <= targetRemain) {
          target.push(...group);
          if (preferTop) topRemain -= group.length;
          else bottomRemain -= group.length;
          return;
        }

        target.push(...group.slice(0, targetRemain));
        fallback.push(...group.slice(targetRemain, targetRemain + fallbackRemain));
        if (preferTop) {
          topRemain = 0;
          bottomRemain = Math.max(0, bottomRemain - (group.length - targetRemain));
        } else {
          bottomRemain = 0;
          topRemain = Math.max(0, topRemain - (group.length - targetRemain));
        }
      });

      topSlots.forEach((slot, index) => {
        const name = topQueue[index];
        if (name) setSeatValue(next, slot, name);
      });

      bottomSlots.forEach((slot, index) => {
        const name = bottomQueue[index];
        if (name) setSeatValue(next, slot, name);
      });

      const remaining = [...topQueue.slice(topSlots.length), ...bottomQueue.slice(bottomSlots.length)];
      neutralSlots.forEach((slot, index) => {
        const name = remaining[index];
        if (name) setSeatValue(next, slot, name);
      });

      setAssignment(next);
      setSeated(true);
      return;
    }

    if (mode === 'groupCluster') {
      const groups = splitIntoGroups(names, Math.max(1, groupCount));
      let cursor = 0;
      groups.forEach(group => {
        group.forEach(n => {
          if (cursor >= availableSlots.length) return;
          setSeatValue(next, availableSlots[cursor++], n);
        });
      });
    } else {
      names.slice(0, availableSlots.length).forEach((name, i) => {
        setSeatValue(next, availableSlots[i], name);
      });
    }

    setAssignment(next);
    setSeated(true);
  };

  const sanitizeAssignment = (
    raw: ConferenceRoomAssignment,
    nextSeatsPerSide: number,
    nextCompanionRows: number
  ) => {
    const validStudentNames = new Set(students.map(s => s.name));
    const normalizeName = (name: string) => (validStudentNames.has(name) ? name : '');
    return {
      headLeft: normalizeName(raw.headLeft || ''),
      headRight: normalizeName(raw.headRight || ''),
      mainTop: Array.from({ length: nextSeatsPerSide }, (_, i) => normalizeName(raw.mainTop?.[i] || '')),
      mainBottom: Array.from({ length: nextSeatsPerSide }, (_, i) => normalizeName(raw.mainBottom?.[i] || '')),
      companionTop: Array.from({ length: nextCompanionRows }, (_, r) =>
        Array.from({ length: nextSeatsPerSide }, (_, i) => normalizeName(raw.companionTop?.[r]?.[i] || ''))
      ),
      companionBottom: Array.from({ length: nextCompanionRows }, (_, r) =>
        Array.from({ length: nextSeatsPerSide }, (_, i) => normalizeName(raw.companionBottom?.[r]?.[i] || ''))
      ),
    };
  };

  const buildSnapshot = () => ({
    seatsPerSide,
    groupCount,
    mode,
    seatGap,
    showCompanionSeats,
    companionRows,
    assignment,
    closedSeats: Array.from(closedSeats),
    seated,
    updatedAt: new Date().toISOString(),
  });

  const saveToHistory = async () => {
    if (!seated) {
      toast.error(t('seat.editor.common.noSeatsToSave'));
      return;
    }
    const name = recordName.trim() || `${t('seat.editor.scene.conference')}-${new Date().toLocaleString()}`;
    const item = saveConferenceRoomHistory(name, buildSnapshot());
    let savedItem: ConferenceRoomHistoryItem = item;
    const cloud = await saveCloudSeatHistory('conference', name, item.snapshot);
    if (cloud) savedItem = { id: cloud.id, name: cloud.name, createdAt: cloud.createdAt, snapshot: cloud.snapshot } as ConferenceRoomHistoryItem;
    const nextItems = [savedItem, ...historyItems].slice(0, 50);
    setHistoryItems(nextItems);
    setSelectedHistoryId(savedItem.id);
    setRecordName(name);
    saveConferenceRoomSnapshot(item.snapshot);
    toast.success(cloud ? t('seat.editor.common.savedHistoryCloud') : t('seat.editor.common.savedHistoryLocal'));
  };

  const restoreFromHistory = () => {
    const item = historyItems.find(history => history.id === selectedHistoryId);
    if (!item) {
      toast.error(t('seat.editor.common.noHistorySelected'));
      return;
    }
    const snapshot = item.snapshot;
    const nextSeatsPerSide = Math.max(4, Math.min(18, snapshot.seatsPerSide));
    const nextGroupCount = Math.max(2, Math.min(20, snapshot.groupCount));
    const nextCompanionRows = Math.max(1, Math.min(4, snapshot.companionRows));

    setSeatsPerSide(nextSeatsPerSide);
    setGroupCount(nextGroupCount);
    setMode(snapshot.mode);
    setSeatGap(Math.max(2, Math.min(20, snapshot.seatGap)));
    setShowCompanionSeats(!!snapshot.showCompanionSeats);
    setCompanionRows(nextCompanionRows);
    setSeated(!!snapshot.seated);
    setRecordName(item.name);

    const nextAssignment = sanitizeAssignment(snapshot.assignment, nextSeatsPerSide, nextCompanionRows);
    setAssignment(nextAssignment);
    setClosedSeats(new Set(snapshot.closedSeats || []));

    saveConferenceRoomSnapshot({
      ...snapshot,
      assignment: nextAssignment,
      closedSeats: snapshot.closedSeats || [],
    });
    toast.success(t('seat.editor.common.restoredHistory'));
  };

  useEffect(() => {
    setHistoryItems(loadConferenceRoomHistory());
    (async () => {
      await migrateLocalToCloudOnce('conference');
      const cloud = await fetchCloudSeatHistory<ConferenceRoomHistoryItem['snapshot']>('conference');
      if (cloud) setHistoryItems(cloud.map(r => ({ id: r.id, name: r.name, createdAt: r.createdAt, snapshot: r.snapshot })) as ConferenceRoomHistoryItem[]);
    })();
  }, []);

  useEffect(() => {
    if (restoredOnceRef.current) return;
    const snapshot = loadConferenceRoomSnapshot();
    if (!snapshot) {
      restoredOnceRef.current = true;
      return;
    }

    const nextSeatsPerSide = Math.max(4, Math.min(18, snapshot.seatsPerSide));
    const nextGroupCount = Math.max(2, Math.min(20, snapshot.groupCount));
    const nextCompanionRows = Math.max(1, Math.min(4, snapshot.companionRows));

    setSeatsPerSide(nextSeatsPerSide);
    setGroupCount(nextGroupCount);
    setMode(snapshot.mode);
    setSeatGap(Math.max(2, Math.min(20, snapshot.seatGap)));
    setShowCompanionSeats(!!snapshot.showCompanionSeats);
    setCompanionRows(nextCompanionRows);
    setSeated(!!snapshot.seated);

    const nextAssignment = sanitizeAssignment(snapshot.assignment, nextSeatsPerSide, nextCompanionRows);
    setAssignment(nextAssignment);
    setClosedSeats(new Set(snapshot.closedSeats || []));
    restoredOnceRef.current = true;
  }, [students]);

  useEffect(() => {
    if (!restoredOnceRef.current) return;
    saveConferenceRoomSnapshot(buildSnapshot());
  }, [assignment, seatsPerSide, groupCount, mode, seatGap, showCompanionSeats, companionRows, closedSeats, seated]);

  const renderSeat = (x: number, y: number, name: string, slot: string) => {
    const isClosed = closedSeats.has(slot);
    const isDragging = dragFrom === slot;
    const isOver = dropTarget === slot;

    return (
      <g
        key={slot}
        style={{ cursor: name && !isClosed ? 'grab' : 'pointer' }}
        onMouseDown={
          name && !isClosed
            ? e => {
                e.stopPropagation();
                setDragFrom(slot);
                setDropTarget(slot);
              }
            : undefined
        }
        onMouseEnter={() => {
          if (dragFrom && !isClosed) setDropTarget(slot);
        }}
        onMouseUp={() => {
          if (!dragFrom || !dropTarget) return;
          const from = dragFrom;
          const to = dropTarget;

          if (from === to || closedSeats.has(from) || closedSeats.has(to)) {
            setDragFrom(null);
            setDropTarget(null);
            return;
          }

          setAssignment(prev => {
            const next: ConferenceRoomAssignment = {
              headLeft: prev.headLeft,
              headRight: prev.headRight,
              mainTop: [...prev.mainTop],
              mainBottom: [...prev.mainBottom],
              companionTop: prev.companionTop.map(row => [...row]),
              companionBottom: prev.companionBottom.map(row => [...row]),
            };

            const fromVal = getSeatValue(next, from);
            const toVal = getSeatValue(next, to);
            setSeatValue(next, from, toVal);
            setSeatValue(next, to, fromVal);
            return next;
          });

          setDragFrom(null);
          setDropTarget(null);
        }}
        onClick={() => {
          if (!name) toggleSeatOpen(slot);
        }}
      >
        <rect
          x={x}
          y={y}
          width={seatW}
          height={seatH}
          rx={6}
          className={
            isClosed
              ? 'fill-muted stroke-destructive/60'
              : isDragging
                ? 'fill-primary/20 stroke-primary'
                : isOver
                  ? 'fill-accent stroke-primary'
                  : name
                    ? 'fill-card stroke-border'
                    : 'fill-muted/50 stroke-border/50'
          }
          strokeWidth={isOver ? 2.5 : 1.5}
        />
        {isClosed && (
          <text
            x={x + seatW / 2}
            y={y + seatH / 2 + 1}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-destructive text-xs"
          >
            {t('seat.editor.common.off')}
          </text>
        )}
        {name && !isDragging && (
          <text
            x={x + seatW / 2}
            y={y + seatH / 2 + 1}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-foreground text-xs"
            style={{ fill: getNameColor(name) }}
          >
            {name.length > 3 ? name.slice(0, 3) : name}
          </text>
        )}
      </g>
    );
  };

  return (
    <div
      onMouseUp={() => {
        setDragFrom(null);
        setDropTarget(null);
      }}
      onMouseLeave={() => {
        setDragFrom(null);
        setDropTarget(null);
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
          {t('seat.editor.conf.seatsPerSide')}
          <Input
            type="number"
            min={4}
            max={18}
            value={seatsPerSide}
            onChange={e => setSeatsPerSide(Math.max(4, Math.min(18, Number(e.target.value))))}
            className="w-16 h-8 text-center"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {t('seat.editor.common.spacing')}
          <Input
            type="number"
            min={2}
            max={20}
            value={seatGap}
            onChange={e => setSeatGap(Math.max(2, Math.min(20, Number(e.target.value))))}
            className="w-16 h-8 text-center"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={showCompanionSeats}
            onChange={e => setShowCompanionSeats(e.target.checked)}
            className="accent-primary"
          />
          {t('seat.editor.conf.showCompanion')}
        </label>
        {showCompanionSeats && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            {t('seat.editor.conf.companionCols')}
            <Input
              type="number"
              min={1}
              max={4}
              value={companionRows}
              onChange={e => setCompanionRows(Math.max(1, Math.min(4, Number(e.target.value))))}
              className="w-14 h-8 text-center"
            />
          </label>
        )}
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={showOrgColorMark}
            onChange={e => setShowOrgColorMark(e.target.checked)}
            className="accent-primary"
          />
          {t('seat.editor.common.orgColor')}
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {t('seat.editor.common.mode')}
          <select
            value={mode}
            onChange={e => setMode(e.target.value as ConferenceSeatMode)}
            className="h-8 px-2 rounded-md border border-input bg-background text-foreground text-sm"
          >
            <option value="balanced">{t('seat.editor.common.modeBalanced')}</option>
            <option value="groupCluster">{t('seat.editor.common.modeGroupCluster')}</option>
            <option value="verticalS">{t('seat.editor.common.modeVerticalS')}</option>
            <option value="horizontalS">{t('seat.editor.common.modeHorizontalS')}</option>
            <option value="orgSideRankCenter">{t('seat.editor.common.modeOrgSideRankCenter')}</option>
          </select>
        </label>
        {mode === 'groupCluster' && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            {t('seat.editor.common.groupCount')}
            <Input
              type="number"
              min={2}
              max={20}
              value={groupCount}
              onChange={e => setGroupCount(Math.max(2, Math.min(20, Number(e.target.value))))}
              className="w-16 h-8 text-center"
            />
          </label>
        )}
        <div className="flex w-full sm:w-auto sm:min-w-[24rem] items-center gap-2 rounded-md border border-border/60 bg-background/80 px-2 py-1">
          <Button variant="outline" onClick={saveToHistory} className="gap-2 h-8" disabled={!seated}>
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
              renameSeatHistoryLocal('conference', id, next);
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
              deleteSeatHistoryLocal('conference', id);
              setHistoryItems(prev => prev.filter(h => h.id !== id));
              setSelectedHistoryId('');
              toast.success(t('seat.editor.common.deleted'));
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
        <Button variant="outline" onClick={() => setRefPositions(defaultRefPositions)}>
          {t('seat.editor.common.resetReferences')}
        </Button>
        <TitleRankConfigDialog
          value={titleRankRuleText}
          sceneLabel={t('seat.editor.scene.conference')}
          onSave={next => {
            const saved = saveTitleRankRuleText(next, 'conference');
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
            <input type="checkbox" checked={refVisible.window} onChange={() => toggleRefVisible('window')} className="accent-primary" /> {t('seat.editor.common.window')}
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={refVisible.frontDoor}
              onChange={() => toggleRefVisible('frontDoor')}
              className="accent-primary"
            />
            {t('seat.editor.common.frontDoor')}
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={refVisible.backDoor}
              onChange={() => toggleRefVisible('backDoor')}
              className="accent-primary"
            />
            {t('seat.editor.common.backDoor')}
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={refLocked} onChange={e => setRefLocked(e.target.checked)} className="accent-primary" /> {t('seat.editor.common.lockReferences')}
          </label>
        </div>
        {seated && (
          <ExportButtons
            targetRef={printRef}
            filename={recordName.trim() || t('seat.editor.scene.conferenceFile')}
            resolveQrCode={resolveQrCode}
            titleValue={recordName}
            onTitleChange={setRecordName}
            hideTitleInput
          />
        )}
        {seated && (
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
              setAssignment(prev => ({
                headLeft: '',
                headRight: '',
                mainTop: prev.mainTop.map(() => ''),
                mainBottom: prev.mainBottom.map(() => ''),
                companionTop: prev.companionTop.map(row => row.map(() => '')),
                companionBottom: prev.companionBottom.map(row => row.map(() => '')),
              }));
              setSeated(true);
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
        {seated ? (
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
              {refVisible.podium && (
                <div className={refBadgeClass} style={{ left: refPositions.podium.x, top: refPositions.podium.y }} onMouseDown={e => startRefDrag(e, 'podium')}>
                  <span className={refIconClass}>🏫</span>
                  <span className={refTextClass}>{t('seat.editor.common.podium')}</span>
                </div>
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

              <svg width={roomWidth} height={roomHeight} viewBox={`0 0 ${roomWidth} ${roomHeight}`} className="font-sans" style={{ fontFamily: 'var(--font-family)' }}>
                <rect x={tableX} y={tableY} width={tableW} height={tableH} rx={10} className="fill-primary/10 stroke-primary/30" strokeWidth={2} />

                {Array.from({ length: seatsPerSide }).map((_, i) => {
                  const x = tableX + gap + i * (seatW + gap);
                  const y = tableY - seatH - sideGap;
                  return renderSeat(x, y, assignment.mainTop[i] || '', `main-top-${i}`);
                })}

                {Array.from({ length: seatsPerSide }).map((_, i) => {
                  const x = tableX + gap + i * (seatW + gap);
                  const y = tableY + tableH + sideGap;
                  return renderSeat(x, y, assignment.mainBottom[i] || '', `main-bottom-${i}`);
                })}

                {showCompanionSeats &&
                  Array.from({ length: companionRows }).map((_, row) => (
                    <g key={`companion-row-${row}`}>
                      {Array.from({ length: seatsPerSide }).map((__, i) => {
                        const x = tableX + gap + i * (seatW + gap);
                        const topY = tableY - seatH - sideGap - (row + 1) * (seatH + sideGap);
                        const bottomY = tableY + tableH + sideGap + (row + 1) * (seatH + sideGap);
                        return (
                          <g key={`companion-slot-${row}-${i}`}>
                            {renderSeat(x, topY, assignment.companionTop[row]?.[i] || '', `companion-top-${row}-${i}`)}
                            {renderSeat(x, bottomY, assignment.companionBottom[row]?.[i] || '', `companion-bottom-${row}-${i}`)}
                          </g>
                        );
                      })}
                    </g>
                  ))}

                {renderSeat(tableX - seatW - headGap, tableY + (tableH - seatH) / 2, assignment.headLeft, 'head-left')}
                {renderSeat(tableX + tableW + headGap, tableY + (tableH - seatH) / 2, assignment.headRight, 'head-right')}

                <text
                  x={tableX + tableW / 2}
                  y={tableY + tableH / 2 + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-primary text-sm font-medium"
                >
                  {t('seat.editor.conf.meetingTable')}
                </text>
              </svg>
              </div>
            </div>
          </div>
        </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg mb-2">{t('seat.editor.common.clickAutoToStart')}</p>
            <p className="text-sm">
              {tFormat(
                t('seat.editor.conf.startHint'),
                seatsPerSide,
                showCompanionSeats ? tFormat(t('seat.editor.conf.companionDesc'), companionRows) : t('seat.editor.conf.noCompanion'),
              )}
            </p>
          </div>
        )}
      </div>

      {seated && (
        <p className="text-center text-xs text-muted-foreground mt-4">
          {t('seat.editor.conf.dragHint')}
        </p>
      )}
      <SeatCheckinDialog
        open={checkinOpen}
        onOpenChange={setCheckinOpen}
        seatData={assignment}
        studentNames={students.map(s => s.name)}
        seatAssignmentReady={seated}
        sceneType="conference"
        sceneConfig={exportSceneConfig}
        className={recordName.trim() || exportClassName}
        pngFileName={recordName.trim() || t('seat.editor.scene.conferenceFile')}
        onSessionCreated={({ checkinUrl }) => handleSessionCreated(checkinUrl)}
      />
    </div>
  );
}
