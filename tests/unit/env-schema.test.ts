import { describe, expect, it } from 'vitest';
import { parseAppEnv } from '../../lib/env/schema';

const baseEnv = {
  APP_ENV: 'test',
  NEXT_PUBLIC_APP_URL: 'https://test.app.pest.gg',
  DATABASE_URL: 'postgres://user:pass@example.com:5432/app',
  CLERK_SECRET_KEY: 'sk_test_example',
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_example',
  R2_ACCOUNT_ID: 'account',
  R2_ACCESS_KEY_ID: 'access',
  R2_SECRET_ACCESS_KEY: 'secret',
  R2_BUCKET_NAME: 'pest-gg-app-staging',
  R2_PUBLIC_BASE_URL: 'https://files-test.app.pest.gg',
  INNGEST_EVENT_KEY: 'event-key',
  INNGEST_SIGNING_KEY: 'signing-key',
  INNGEST_ENV: 'test',
};

describe('parseAppEnv', () => {
  it('parses a valid test environment', () => {
    expect(parseAppEnv(baseEnv)).toMatchObject({
      APP_ENV: 'test',
      NEXT_PUBLIC_APP_URL: 'https://test.app.pest.gg',
      R2_BUCKET_NAME: 'pest-gg-app-staging',
      INNGEST_ENV: 'test',
    });
  });

  it('rejects production when the bucket still looks like staging', () => {
    expect(() =>
      parseAppEnv({
        ...baseEnv,
        APP_ENV: 'prod',
        NEXT_PUBLIC_APP_URL: 'https://app.pest.gg',
        R2_BUCKET_NAME: 'pest-gg-app-staging',
      }),
    ).toThrow('Production cannot use a staging storage bucket.');
  });

  it('rejects production buckets with unsafe names regardless of casing', () => {
    expect(() =>
      parseAppEnv({
        ...baseEnv,
        APP_ENV: 'prod',
        NEXT_PUBLIC_APP_URL: 'https://app.pest.gg',
        R2_BUCKET_NAME: 'starter-STAGING',
      }),
    ).toThrow('Production cannot use a staging storage bucket.');
  });

  it('rejects production when the bucket does not match project config', () => {
    expect(() =>
      parseAppEnv({
        ...baseEnv,
        APP_ENV: 'prod',
        NEXT_PUBLIC_APP_URL: 'https://app.pest.gg',
        R2_BUCKET_NAME: 'starter-live',
      }),
    ).toThrow('Production storage bucket must match projectConfig.storageBuckets.prod.');
  });

  it('rejects test buckets that look like production', () => {
    expect(() =>
      parseAppEnv({
        ...baseEnv,
        R2_BUCKET_NAME: 'pest-gg-app-production',
      }),
    ).toThrow('Test cannot use a production storage bucket.');
  });

  it('rejects test when the bucket does not match project config', () => {
    expect(() =>
      parseAppEnv({
        ...baseEnv,
        R2_BUCKET_NAME: 'starter-qa',
      }),
    ).toThrow('Test storage bucket must match projectConfig.storageBuckets.test.');
  });

  it('rejects invalid urls', () => {
    expect(() =>
      parseAppEnv({
        ...baseEnv,
        NEXT_PUBLIC_APP_URL: 'not-a-url',
      }),
    ).toThrow();
  });

  it('rejects missing required values', () => {
    expect(() =>
      parseAppEnv({
        ...baseEnv,
        DATABASE_URL: '',
      }),
    ).toThrow();
  });

  it('rejects missing APP_ENV', () => {
    const envWithoutAppEnv: Record<string, string | undefined> = { ...baseEnv };
    delete envWithoutAppEnv.APP_ENV;

    expect(() => parseAppEnv(envWithoutAppEnv)).toThrow();
  });
});
