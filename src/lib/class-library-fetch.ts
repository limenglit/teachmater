/**
 * Shared, fully paginated readers for the class library.
 *
 * PostgREST caps a single request at 1000 rows, so any picker that fetched
 * `class_students` in one shot silently lost classes / students once the
 * library grew. Every roster picker must go through these helpers.
 */
import { supabase } from '@/integrations/supabase/client';

const PAGE_SIZE = 1000;

export interface LibraryCollege { id: string; name: string }
export interface LibraryClass { id: string; name: string; college_id: string }
export interface LibraryClassStudent { class_id: string; name: string; student_number?: string | null }

async function fetchAllPages<T>(
  table: 'colleges' | 'classes' | 'class_students',
  columns: string,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data || []) as unknown as T[];
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return all;
}

/** Read the whole class library for the signed-in teacher (RLS scoped). */
export async function fetchClassLibrary(): Promise<{
  colleges: LibraryCollege[];
  classes: LibraryClass[];
  classStudents: LibraryClassStudent[];
}> {
  const [colleges, classes, classStudents] = await Promise.all([
    fetchAllPages<LibraryCollege>('colleges', 'id, name'),
    fetchAllPages<LibraryClass>('classes', 'id, name, college_id'),
    fetchAllPages<LibraryClassStudent>('class_students', 'class_id, name, student_number'),
  ]);
  return { colleges, classes, classStudents };
}
