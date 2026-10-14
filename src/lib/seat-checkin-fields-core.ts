/** 签到页首屏只需要的填写项工具（解析配置、校验必填），完整版见 seat-checkin-fields.ts。 */
import type { CheckinCustomField, CheckinFieldType } from '@/lib/seat-checkin-fields';

const MAX = 8;
const slug = (label: string) => label.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
const fieldId = (label: string, used: string[]) => {
  const base = slug(label) || `field_${used.length + 1}`;
  let id = base;
  for (let i = 2; used.includes(id); i++) id = `${base}_${i}`;
  return id;
};

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
      const id = String(f.id ?? '').trim() || fieldId(label, used);
      if (used.includes(id)) return;
      used.push(id);
      const type = f.type === 'tel' || f.type === 'number' ? (f.type as CheckinFieldType) : 'text';
      fields.push({ id, label: label.slice(0, 20), required: f.required !== false, type });
    });
    return fields.slice(0, MAX);
  }
  const legacy: CheckinCustomField[] = [];
  if (cfg.collectOrg === true) legacy.push({ id: 'org', label: '单位', required: true, type: 'text' });
  if (cfg.collectPhone === true) legacy.push({ id: 'phone', label: '手机号', required: true, type: 'tel' });
  return legacy;
}

export function findMissingRequiredField(fields: CheckinCustomField[], values: Record<string, string>): CheckinCustomField | null {
  return fields.find(f => f.required && !(values[f.id] || '').trim()) || null;
}

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
