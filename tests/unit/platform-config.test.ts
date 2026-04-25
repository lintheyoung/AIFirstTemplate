import { describe, expect, it } from 'vitest';
import { branchToEnvironment, platformConfig } from '../../config/platform';

describe('platformConfig', () => {
  it('uses staging as the hosted test branch', () => {
    expect(platformConfig.environments.test.branch).toBe('staging');
  });

  it('maps branches to environments', () => {
    expect(branchToEnvironment('feature/add-export')).toBe('dev');
    expect(branchToEnvironment('staging')).toBe('test');
    expect(branchToEnvironment('main')).toBe('prod');
  });
});
