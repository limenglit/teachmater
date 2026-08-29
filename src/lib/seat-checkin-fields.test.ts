import { describe, it, expect } from 'vitest';
import {
  normalizeCustomFields,
  splitFieldValues,
  findMissingRequiredField,
  resolveExportFields,
  readFieldValue,
} from './seat-checkin-fields';

describe('seat-checkin-fields', () => {
  it('migrates legacy collectOrg/collectPhone', () => {
    const fields = normalizeCustomFields({ collectOrg: true, collectPhone: true });
    expect(fields.map(f => f.id)).toEqual(['org', 'phone']);
  });

  it('reads custom fields and drops empty labels', () => {
    const fields = normalizeCustomFields({ customFields: [{ id: 'dept', label: '部门', required: false }, { label: '' }] });
    expect(fields).toEqual([{ id: 'dept', label: '部门', required: false, type: 'text' }]);
  });

  it('splits values into org/phone/extra', () => {
    const fields = normalizeCustomFields({ customFields: [{ id: 'org', label: '单位' }, { id: 'dept', label: '部门' }] });
    expect(splitFieldValues(fields, { org: ' A ', dept: '研发' })).toEqual({ org: 'A', phone: '', extra: { dept: '研发' } });
  });

  it('detects missing required field', () => {
    const fields = normalizeCustomFields({ customFields: [{ id: 'dept', label: '部门', required: true }] });
    expect(findMissingRequiredField(fields, {})?.label).toBe('部门');
    expect(findMissingRequiredField(fields, { dept: 'x' })).toBeNull();
  });

  it('includes historical data columns on export', () => {
    const cols = resolveExportFields([], [{ org: '甲公司', extra_fields: { dept: '研发' } }]);
    expect(cols.map(c => c.id)).toEqual(['org', 'dept']);
    expect(readFieldValue({ extra_fields: { dept: '研发' } }, 'dept')).toBe('研发');
  });
});
