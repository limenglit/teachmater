import { beforeEach, describe, expect, it } from 'vitest';
import {
  deleteCustomTeamingPreset,
  loadTeamingPresets,
  saveCustomTeamingPreset,
} from './teaming-presets';

beforeEach(() => {
  localStorage.clear();
});

describe('teaming presets', () => {
  it('contains built-in presets by default', () => {
    const presets = loadTeamingPresets('groups');
    expect(presets.some(p => p.name === '企业培训模板')).toBe(true);
    expect(presets.some(p => p.name === '政务会议模板')).toBe(true);
  });

  it('can save and delete custom presets', () => {
    const created = saveCustomTeamingPreset('teams', {
      name: '我的模板',
      strategy: 'custom',
      customPrimaryDimension: 'organization',
      customBalanceDimensions: ['gender', 'titleLevel'],
    });

    const afterSave = loadTeamingPresets('teams');
    expect(afterSave.some(p => p.id === created.id)).toBe(true);

    deleteCustomTeamingPreset('teams', created.id);
    const afterDelete = loadTeamingPresets('teams');
    expect(afterDelete.some(p => p.id === created.id)).toBe(false);
  });
});
