// Shared seating algorithms used by different scene components.
export function distributeToTables(names: string[], tableCount: number, seatsPerTable: number, shuffle = false) {
  const arr = shuffle ? [...names].sort(() => Math.random() - 0.5) : [...names];
  const tables: string[][] = Array.from({ length: tableCount }, () => []);
  arr.forEach((n, i) => {
    const ti = i % tableCount;
    if (tables[ti].length < seatsPerTable) tables[ti].push(n);
  });
  return tables;
}

export function distributeBanquet(names: string[], seatsPerTable: number, shuffle = false) {
  const tableCount = Math.max(1, Math.ceil(names.length / seatsPerTable));
  return distributeToTables(names, tableCount, seatsPerTable, shuffle);
}

export function distributeSmartClassroom(names: string[], tableCount: number, seatsPerTable: number, shuffle = false) {
  // each table holds up to seatsPerTable students
  return distributeToTables(names, tableCount, seatsPerTable, shuffle);
}

export function distributeConferenceLongTable(names: string[], seatsPerSide: number, shuffle = false) {
  const arr = shuffle ? [...names].sort(() => Math.random() - 0.5) : [...names];
  const headLeft = arr[0] || '';
  const headRight = arr[1] || '';
  const rest = arr.slice(2);
  const top: string[] = [];
  const bottom: string[] = [];
  rest.forEach((n, i) => {
    if (i < seatsPerSide) top.push(n);
    else if (i < seatsPerSide * 2) bottom.push(n);
  });
  return { top, bottom, headLeft, headRight };
}

export function distributeConcertHall(names: string[], seatsPerRow: number, rowCount: number, shuffle = false) {
  const arr = shuffle ? [...names].sort(() => Math.random() - 0.5) : [...names];
  const rows: string[][] = [];
  let idx = 0;
  for (let r = 0; r < rowCount && idx < arr.length; r++) {
    const count = seatsPerRow + r * 2;
    const row: string[] = [];
    for (let c = 0; c < count && idx < arr.length; c++) {
      row.push(arr[idx++]);
    }
    rows.push(row);
  }
  return rows;
}

export function distributeComputerLab(names: string[], rowCount: number, seatsPerSide: number, dualSide = true, shuffle = false) {
  const arr = shuffle ? [...names].sort(() => Math.random() - 0.5) : [...names];
  const result: { rowIndex: number; side: 'top' | 'bottom'; students: string[] }[] = [];
  let idx = 0;
  for (let r = 0; r < rowCount && idx < arr.length; r++) {
    const topSeats: string[] = [];
    for (let i = 0; i < seatsPerSide && idx < arr.length; i++) topSeats.push(arr[idx++]);
    if (topSeats.length) result.push({ rowIndex: r, side: 'top', students: topSeats });

    const bottomSeats: string[] = [];
    for (let i = 0; i < seatsPerSide && idx < arr.length; i++) bottomSeats.push(arr[idx++]);
    if (bottomSeats.length) result.push({ rowIndex: r, side: 'bottom', students: bottomSeats });
  }
  return result;
}
