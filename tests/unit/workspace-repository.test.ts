import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ActorType } from '../../lib/auth/actors';
import { actorTypeValues, workspaceRoleValues } from '../../lib/db/schema';
import {
  canManageApiKeys,
  normalizeWorkspaceRole,
} from '../../lib/workspaces/repository';

const envKeys = [
  'APP_ENV',
  'NEXT_PUBLIC_APP_URL',
  'DATABASE_URL',
  'CLERK_SECRET_KEY',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_BASE_URL',
  'INNGEST_EVENT_KEY',
  'INNGEST_SIGNING_KEY',
  'INNGEST_ENV',
  'KIE_API_KEY',
  'KIE_CALLBACK_BASE_URL',
  'KIE_WEBHOOK_HMAC_KEY',
] as const;

describe('workspace repository helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('normalizes known workspace roles', () => {
    expect(normalizeWorkspaceRole('owner')).toBe('owner');
    expect(normalizeWorkspaceRole('admin')).toBe('admin');
    expect(normalizeWorkspaceRole('member')).toBe('member');
  });

  it('rejects unknown roles', () => {
    expect(() => normalizeWorkspaceRole('viewer')).toThrow("Unknown workspace role 'viewer'.");
  });

  it('allows owners and admins to manage api keys', () => {
    expect(canManageApiKeys('owner')).toBe(true);
    expect(canManageApiKeys('admin')).toBe(true);
    expect(canManageApiKeys('member')).toBe(false);
  });

  it('exposes shared workspace role constants', () => {
    expect(workspaceRoleValues).toEqual(['owner', 'admin', 'member']);
  });

  it('exposes shared actor type constants', () => {
    const assertActorType = (value: ActorType) => value;

    expect(actorTypeValues.map(assertActorType)).toEqual(['user', 'api_key', 'system']);
  });

  it('imports the database module without requiring environment values', async () => {
    vi.resetModules();

    for (const key of envKeys) {
      vi.stubEnv(key, undefined);
    }

    await expect(import('../../lib/db/drizzle')).resolves.toHaveProperty('getDb');
  });
});
