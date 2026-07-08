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

export interface ClassRosterPreviewRow {
  college: string;
  className: string;
  studentNumber: string;
  name: string;
}

export interface ClassRosterPreviewOptions {
  defaultCollegeName?: string;
  defaultClassName?: string;
}

export interface ClassRosterPreviewResult {
  preview: ClassRosterPreviewRow[];
  skippedRows: number;
  usedDefaultClass: boolean;
}

export function normalizeHeaderCell(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[\s_\-\/\\()（）【】\[\]·.、,，:：;；*#"']/g, '');
}

function rowHasRecognizedRosterHeader(row: unknown[]): boolean {
  const header = (row || []).map((c) => normalizeHeaderCell(String(c ?? '')));
  return header.some((h) => (
    /^(学生)?姓名$|^名字$|^name$|^fullname$/.test(h) ||
    /^(学生)?院系$|^学院$|^系别$|^部门$|^单位$|^college$|^department$|^school$|^faculty$|^org$|^unit$/.test(h) ||
    /^班级$|^行政班$|^教学班$|^class$|^grade$|^section$/.test(h) ||
    /^学号$|^工号$|^编号$|^studentid$|^sid$|^no$|^number$/.test(h)
  ));
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

/**
 * Build a class-library import preview from spreadsheet rows.
 * Important: this preserves every non-empty named row. Same-name students are
 * valid in real classrooms, so callers must not deduplicate by name.
 */
export function buildClassRosterPreview(
  rows: unknown[][],
  options: ClassRosterPreviewOptions = {},
): ClassRosterPreviewResult {
  const defaultCollegeName = options.defaultCollegeName || '未分类院系';
  const defaultClassName = options.defaultClassName || '未分类班级';
  const firstRow = rows[0] || [];
  const hasHeader = rowHasRecognizedRosterHeader(firstRow);
  const { nameCol, collegeCol, classCol, numberCol } = hasHeader
    ? resolveRosterColumns(firstRow)
    : {
        // Headerless spreadsheets are common when users export a plain list.
        // For 4+ columns keep the legacy layout [院系, 班级, 学号, 姓名];
        // for 1-3 columns treat the first column as 姓名 so rows are not lost.
        collegeCol: firstRow.length >= 4 ? 0 : -1,
        classCol: firstRow.length >= 4 ? 1 : -1,
        numberCol: firstRow.length >= 4 ? 2 : -1,
        nameCol: firstRow.length >= 4 ? 3 : 0,
      };
  const dataRows = hasHeader ? rows.slice(1) : rows;

  let skippedRows = 0;
  let usedDefaultClass = false;
  const preview: ClassRosterPreviewRow[] = [];

  for (const row of dataRows) {
    if (!row || row.every((c) => !c || String(c).trim() === '')) {
      skippedRows++;
      continue;
    }

    const name = String(row[nameCol] ?? '').trim();
    if (!name) {
      skippedRows++;
      continue;
    }

    const college = collegeCol >= 0 ? String(row[collegeCol] ?? '').trim() : '';
    const className = classCol >= 0 ? String(row[classCol] ?? '').trim() : '';
    const resolvedCollege = college || defaultCollegeName;
    const resolvedClassName = className || defaultClassName;
    if (!college || !className) usedDefaultClass = true;

    preview.push({
      college: resolvedCollege,
      className: resolvedClassName,
      studentNumber: numberCol >= 0 ? String(row[numberCol] ?? '').trim() : '',
      name,
    });
  }

  return { preview, skippedRows, usedDefaultClass };
}
