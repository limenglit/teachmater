/**
 * Roster import helpers — tolerant column-name detection.
 *
 * Templates vary across schools (Chinese/English headers, "学号" vs "工号",
 * "院系" vs "学院" vs "单位", "Student Name" vs "姓名" vs "full_name"…).
 * `resolveRosterColumns` normalizes header text and maps aliases to the four
 * canonical fields used by the importer: name / college / class / number.
 */

export interface RosterColumns {
  nameCol: number;
  collegeCol: number;
  classCol: number;
  numberCol: number;
}

export function normalizeHeaderCell(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[\s_\-\/\\()（）【】\[\]·.、,，:：;；*#"']/g, '');
}

/**
 * Resolve canonical column indexes from a header row.
 * Falls back to the legacy positional layout [college, class, number, name]
 * when a header cell cannot be matched.
 */
export function resolveRosterColumns(headerRow: unknown[]): RosterColumns {
  const header = (headerRow || []).map((c) => normalizeHeaderCell(String(c ?? '')));

  const findCol = (keys: string[], exclude: string[] = []) =>
    header.findIndex(
      (h) => h && !exclude.some((x) => h.includes(x)) && keys.some((k) => h.includes(k)),
    );

  // Detect 姓名 first; exclude tokens that would cause "学生学号" or "班级" to win.
  let nameCol = findCol(
    ['姓名', '名字', 'name', 'fullname', 'student', '学生'],
    ['班', '学号', '工号', 'id', 'no'],
  );
  let collegeCol = findCol([
    '院系', '学院', '系别', '部门', '单位',
    'college', 'department', 'school', 'faculty', 'org', 'unit',
  ]);
  let classCol = findCol(
    ['班级', '行政班', '教学班', '班次', 'class', 'grade', 'section'],
    ['学号', '工号'],
  );
  let numberCol = findCol([
    '学号', '工号', '编号', 'number', 'studentid', 'sid', 'no',
  ]);

  // Legacy positional fallback: [college, class, number, name]
  if (nameCol < 0) nameCol = header.length >= 4 ? 3 : 2;
  if (collegeCol < 0) collegeCol = 0;
  if (classCol < 0) classCol = 1;
  if (numberCol < 0) numberCol = header.length >= 4 ? 2 : -1;

  return { nameCol, collegeCol, classCol, numberCol };
}
