/**
 * 排座记录（教室场景）按班级归档。
 *
 * 保存时把当前激活的班级（名称 + 班级 ID）写进快照，切换班级时历史下拉框只
 * 展示与当前班级匹配的记录；没有标注班级的旧记录始终可见，避免升级后“丢记录”。
 */
import { getActiveClassContext, type ActiveClassContext } from '@/lib/class-context';

export interface SnapshotClassContext {
  label: string;
  classIds: string[];
  collegeIds: string[];
}

export interface ClassTaggedSnapshot {
  classContext?: SnapshotClassContext;
}

export interface ClassTaggedHistoryItem<S = unknown> {
  id: string;
  name: string;
  createdAt: string;
  snapshot: S;
}

const normalizeLabel = (value: string) =>
  value.replace(/\u3000/g, ' ').replace(/\s+/g, '').trim().toLowerCase();

const cleanIds = (values: unknown): string[] =>
  Array.isArray(values)
    ? Array.from(new Set(values.filter((v): v is string => typeof v === 'string' && v.trim().length > 0).map(v => v.trim())))
    : [];

/** Read the class tag stored with a snapshot; `null` for legacy (untagged) records. */
export function readSnapshotClassContext(snapshot: unknown): SnapshotClassContext | null {
  const raw = (snapshot as ClassTaggedSnapshot | null | undefined)?.classContext;
  if (!raw || typeof raw !== 'object') return null;
  const label = typeof raw.label === 'string' ? raw.label.trim() : '';
  const classIds = cleanIds(raw.classIds);
  const collegeIds = cleanIds(raw.collegeIds);
  if (!label && classIds.length === 0) return null;
  return { label, classIds, collegeIds };
}

/** Stamp the active class onto a snapshot right before it is saved. */
export function withActiveClassContext<S extends object>(snapshot: S, context?: ActiveClassContext): S {
  const ctx = context ?? getActiveClassContext();
  const label = (ctx.label || '').trim();
  const classIds = cleanIds(ctx.classIds);
  const collegeIds = cleanIds(ctx.collegeIds);
  if (!label && classIds.length === 0) return snapshot;
  return { ...snapshot, classContext: { label, classIds, collegeIds } };
}

/** Does this snapshot belong to the given class? Untagged records match anything. */
export function snapshotMatchesClass(snapshot: unknown, context: ActiveClassContext): boolean {
  const active = { label: (context.label || '').trim(), classIds: cleanIds(context.classIds) };
  if (!active.label && active.classIds.length === 0) return true;

  const tag = readSnapshotClassContext(snapshot);
  if (!tag) return true; // legacy record: never hide it

  if (tag.classIds.length > 0 && active.classIds.length > 0) {
    return tag.classIds.some(id => active.classIds.includes(id));
  }
  if (!tag.label || !active.label) return false;
  return normalizeLabel(tag.label) === normalizeLabel(active.label);
}

/** Filter a history list down to the records that belong to the active class. */
export function filterHistoryByClass<T extends ClassTaggedHistoryItem>(
  items: T[],
  context: ActiveClassContext,
): T[] {
  return items.filter(item => snapshotMatchesClass(item.snapshot, context));
}

/** Short badge text for the history dropdown, e.g. 「计算机1班」. */
export function historyClassLabel(snapshot: unknown): string {
  return readSnapshotClassContext(snapshot)?.label ?? '';
}
