/**
 * 扫码签到「自定义填写项」配置与取值工具。
 *
 * 教师在发布签到码时可自定义任意数量（上限 MAX_CHECKIN_CUSTOM_FIELDS）的填写项，
 * 例如：单位、手机号、部门、工号……配置持久化在 sceneConfig.customFields。
 *
 * 为兼容旧版本的 collectOrg / collectPhone 两个开关，读取配置时会自动把它们
 * 转换成 id 为 'org' / 'phone' 的自定义项；这两个 id 的取值仍写入记录表的
 * org / phone 列，其余字段写入 extra_fields (jsonb)。
 */

export type CheckinFieldType = 'text' | 'tel' | 'number';

export interface CheckinCustomField {
  id: string;
  label: string;
  required: boolean;
  type: CheckinFieldType;
}

export const MAX_CHECKIN_CUSTOM_FIELDS = 8;

export const LEGACY_ORG_FIELD: CheckinCustomField = { id: 'org', label: '单位', required: true, type: 'text' };
export const LEGACY_PHONE_FIELD: CheckinCustomField = { id: 'phone', label: '手机号', required: true, type: 'tel' };

/** 常用填写项快捷模板 */
export const CHECKIN_FIELD_PRESETS: CheckinCustomField[] = [
  LEGACY_ORG_FIELD,
  LEGACY_PHONE_FIELD,
  { id: 'department', label: '部门', required: true, type: 'text' },
  { id: 'studentNo', label: '学号', required: true, type: 'text' },
  { id: 'title', label: '职务', required: true, type: 'text' },
  { id: 'email', label: '邮箱', required: true, type: 'text' },
];

const slug = (label: string) =>
  label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);

/** 依据标签生成唯一 id */
export function createFieldId(label: string, used: string[] = []): string {
  const base = slug(label) || `field_${used.length + 1}`;
  let id = base;
  let i = 2;
  while (used.includes(id)) {
    id = `${base}_${i}`;
    i += 1;
  }
  return id;
}

/** 从 sceneConfig 解析自定义填写项（含旧配置迁移） */
export function normalizeCustomFields(sceneConfig: unknown): CheckinCustomField[] {
  const cfg = (sceneConfig || {}) as Record<string, unknown>;
  const raw = cfg.customFields;

  if (Array.isArray(raw)) {
    const used: string[] = [];
    const fields: CheckinCustomField[] = [];
    raw.forEach(item => {
      const f = (item || {}) as Record<string, unknown>;
      const label = String(f.label ?? '').trim();
      if (!label) return;
      const id = String(f.id ?? '').trim() || createFieldId(label, used);
      if (used.includes(id)) return;
      used.push(id);
      const type = f.type === 'tel' || f.type === 'number' ? (f.type as CheckinFieldType) : 'text';
      fields.push({ id, label: label.slice(0, 20), required: f.required !== false, type });
    });
    return fields.slice(0, MAX_CHECKIN_CUSTOM_FIELDS);
  }

  // 旧版兼容
  const legacy: CheckinCustomField[] = [];
  if (cfg.collectOrg === true) legacy.push({ ...LEGACY_ORG_FIELD });
  if (cfg.collectPhone === true) legacy.push({ ...LEGACY_PHONE_FIELD });
  return legacy;
}

/** 读取某条签到记录在某个字段上的值 */
export function readFieldValue(
  record: { org?: string | null; phone?: string | null; extra_fields?: Record<string, unknown> | null },
  fieldId: string,
): string {
  if (fieldId === 'org') return String(record.org ?? '').trim();
  if (fieldId === 'phone') return String(record.phone ?? '').trim();
  const extra = (record.extra_fields || {}) as Record<string, unknown>;
  const v = extra[fieldId];
  return v == null ? '' : String(v).trim();
}

/** 导出 CSV 时使用的列：配置项 + 记录中出现过的历史字段 */
export function resolveExportFields(
  fields: CheckinCustomField[],
  records: Array<{ org?: string | null; phone?: string | null; extra_fields?: Record<string, unknown> | null }>,
): CheckinCustomField[] {
  const result = [...fields];
  const has = (id: string) => result.some(f => f.id === id);

  if (!has('org') && records.some(r => String(r.org ?? '').trim() !== '')) result.push({ ...LEGACY_ORG_FIELD });
  if (!has('phone') && records.some(r => String(r.phone ?? '').trim() !== '')) result.push({ ...LEGACY_PHONE_FIELD });

  records.forEach(r => {
    const extra = (r.extra_fields || {}) as Record<string, unknown>;
    Object.keys(extra).forEach(id => {
      if (!has(id) && String(extra[id] ?? '').trim() !== '') {
        result.push({ id, label: id, required: false, type: 'text' });
      }
    });
  });

  return result;
}

/** 把学生填写的内容拆分为 org / phone / extra 三部分 */
export function splitFieldValues(fields: CheckinCustomField[], values: Record<string, string>) {
  let org = '';
  let phone = '';
  const extra: Record<string, string> = {};
  fields.forEach(f => {
    const v = (values[f.id] || '').trim();
    if (!v) return;
    if (f.id === 'org') org = v;
    else if (f.id === 'phone') phone = v;
    else extra[f.id] = v;
  });
  return { org, phone, extra };
}

/** 校验必填项，返回第一个未填写的字段 */
export function findMissingRequiredField(
  fields: CheckinCustomField[],
  values: Record<string, string>,
): CheckinCustomField | null {
  return fields.find(f => f.required && !(values[f.id] || '').trim()) || null;
}
