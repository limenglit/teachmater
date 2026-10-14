import { classroomDoorOnRight, formatClassroomSeatLabel, normalizeSeatLabelMode } from '@/lib/seat-number';

export const buildSeatHint = (
  sceneType: string,
  seatData: unknown,
  studentName: string,
  sceneConfig?: Record<string, unknown>,
) => {
  if (sceneType === 'classroom') {
    const seats = seatData as (string | null)[][];
    const disabledSeats = Array.isArray(sceneConfig?.disabledSeats) ? (sceneConfig!.disabledSeats as string[]) : [];
    const rowColsCfg = Array.isArray(sceneConfig?.rowCols) ? (sceneConfig!.rowCols as number[]) : [];
    for (let r = 0; r < seats.length; r++) {
      for (let c = 0; c < seats[r].length; c++) {
        if (isSameStudentName(seats[r][c], studentName)) {
          const rowWidth = Number(rowColsCfg[r]) > 0 ? Number(rowColsCfg[r]) : seats[r].length;
          const mode = normalizeSeatLabelMode(sceneConfig?.seatLabelMode);
          const rowWidths = seats.map((row, i) =>
            Number(rowColsCfg[i]) > 0 ? Number(rowColsCfg[i]) : (row?.length ?? 0));
          return formatClassroomSeatLabel(r, c, { rowWidth, disabledSeats, rowWidths, doorOnRight: classroomDoorOnRight(sceneConfig) }, mode);
        }
      }
    }
    return null;
  }

  if (sceneType === 'smartClassroom' || sceneType === 'banquet') {
    const tables = seatData as string[][];
    for (let t = 0; t < tables.length; t++) {
      for (let s = 0; s < tables[t].length; s++) {
        if (isSameStudentName(tables[t][s], studentName)) return `第${t + 1}桌第${s + 1}号座`;
      }
    }
    return null;
  }

  if (sceneType === 'conference') {
    const data = seatData as {
      headLeft?: string;
      headRight?: string;
      top?: string[];
      bottom?: string[];
      mainTop?: string[];
      mainBottom?: string[];
    };
    if (isSameStudentName(data.headLeft, studentName)) return '左侧主位';
    if (isSameStudentName(data.headRight, studentName)) return '右侧主位';
    const top = data.top || data.mainTop || [];
    const bottom = data.bottom || data.mainBottom || [];
    const topIdx = top.findIndex(name => isSameStudentName(name, studentName));
    if (topIdx >= 0) return `上方第${topIdx + 1}位`;
    const bottomIdx = bottom.findIndex(name => isSameStudentName(name, studentName));
    if (bottomIdx >= 0) return `下方第${bottomIdx + 1}位`;
    return null;
  }

  if (sceneType === 'concertHall') {
    const rows = seatData as string[][];
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        if (isSameStudentName(rows[r][c], studentName)) return `第${r + 1}排第${c + 1}座`;
      }
    }
    return null;
  }

  if (sceneType === 'artStudio') {
    const rings = seatData as string[][];
    for (let ring = 0; ring < rings.length; ring++) {
      for (let seat = 0; seat < rings[ring].length; seat++) {
        if (isSameStudentName(rings[ring][seat], studentName)) return `第${ring + 1}圈第${seat + 1}位`;
      }
    }
    return null;
  }

  if (sceneType === 'computerLab') {
    const rows = seatData as Array<{ rowIndex: number; side: 'top' | 'bottom'; students: string[] }>;
    for (const row of rows) {
      const idx = row.students.findIndex(name => isSameStudentName(name, studentName));
      if (idx >= 0) return `第${row.rowIndex + 1}排${row.side === 'top' ? '上侧' : '下侧'}第${idx + 1}位`;
    }
    return null;
  }

  return null;
};

/** Collect every seated name in any scene's seat data shape. */
