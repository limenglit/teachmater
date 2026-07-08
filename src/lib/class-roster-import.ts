import type { ClassRosterPreviewRow } from './roster-import';

export const CLASS_STUDENT_IMPORT_BATCH_SIZE = 500;

export interface ClassStudentInsertRow {
  class_id: string;
  user_id: string;
  name: string;
  student_number: string;
}

export function buildClassStudentInserts(
  rows: ClassRosterPreviewRow[],
  classId: string,
  userId: string,
): ClassStudentInsertRow[] {
  return rows.map(row => ({
    class_id: classId,
    user_id: userId,
    name: row.name,
    student_number: row.studentNumber,
  }));
}

export function chunkClassStudentInserts(
  rows: ClassStudentInsertRow[],
  batchSize = CLASS_STUDENT_IMPORT_BATCH_SIZE,
): ClassStudentInsertRow[][] {
  const chunks: ClassStudentInsertRow[][] = [];
  for (let index = 0; index < rows.length; index += batchSize) {
    chunks.push(rows.slice(index, index + batchSize));
  }
  return chunks;
}