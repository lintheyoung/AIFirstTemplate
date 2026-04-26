import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { runDeployPreflight } from '../../scripts/deploy-preflight';

const testEnv = [
  'APP_ENV=test',
  'NEXT_PUBLIC_APP_URL=https://test.app.pest.gg',
  'DATABASE_URL=postgres://user:pass@example.com:5432/app',
  'CLERK_SECRET_KEY=sk_test_example',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_example',
  'R2_ACCOUNT_ID=account',
  'R2_ACCESS_KEY_ID=access',
  'R2_SECRET_ACCESS_KEY=secret',
  'R2_BUCKET_NAME=pest-gg-app-staging',
  'R2_PUBLIC_BASE_URL=https://files-test.app.pest.gg',
  'INNGEST_EVENT_KEY=event-key',
  'INNGEST_SIGNING_KEY=signing-key',
  'INNGEST_ENV=test',
].join('\n');

function createProjectFixture(args?: { regions?: string[]; envText?: string }) {
  const root = mkdtempSync(join(tmpdir(), 'aifirst-deploy-preflight-'));

  writeFileSync(join(root, '.env.test.local'), args?.envText ?? testEnv);
  writeFileSync(
    join(root, 'vercel.json'),
    JSON.stringify({
      $schema: 'https://openapi.vercel.sh/vercel.json',
      regions: args?.regions ?? ['sin1'],
    }),
  );
  mkdirSync(join(root, '.vercel'));
  writeFileSync(
    join(root, '.vercel/project.json'),
    JSON.stringify({
      projectId: 'prj_test',
      orgId: 'team_test',
      projectName: 'aifirst-template',
    }),
  );

  return root;
}

describe('deploy preflight', () => {
  it('passes when env, Vercel link, region, and Inngest env agree', () => {
    const result = runDeployPreflight({
      root: createProjectFixture(),
      envFile: '.env.test.local',
      expectEnv: 'test',
      expectRegion: 'sin1',
      currentBranch: 'staging',
    });

    expect(result).toMatchObject({
      status: 'ok',
      appEnv: 'test',
      appUrl: 'https://test.app.pest.gg',
      bucket: 'pest-gg-app-staging',
      inngestEnv: 'test',
      region: 'sin1',
      vercelProject: 'aifirst-template',
      warnings: [],
    });
  });

  it('warns when test deploys are being prepared from the production branch', () => {
    const result = runDeployPreflight({
      root: createProjectFixture(),
      envFile: '.env.test.local',
      expectEnv: 'test',
      expectRegion: 'sin1',
      currentBranch: 'main',
    });

    expect(result.warnings).toContain(
      'Vercel cannot persist Preview environment variables on the production branch. Use a staging branch or pass one-off preview env values during deploy.',
    );
  });

  it('fails when Vercel regions do not include the expected deployment region', () => {
    expect(() =>
      runDeployPreflight({
        root: createProjectFixture({ regions: ['iad1'] }),
        envFile: '.env.test.local',
        expectEnv: 'test',
        expectRegion: 'sin1',
        currentBranch: 'staging',
      }),
    ).toThrow('vercel.json regions must include sin1.');
  });

  it('fails when INNGEST_ENV does not match the target environment', () => {
    expect(() =>
      runDeployPreflight({
        root: createProjectFixture({
          envText: testEnv.replace('INNGEST_ENV=test', 'INNGEST_ENV=main'),
        }),
        envFile: '.env.test.local',
        expectEnv: 'test',
        expectRegion: 'sin1',
        currentBranch: 'staging',
      }),
    ).toThrow('Expected INNGEST_ENV=test for APP_ENV=test, but found INNGEST_ENV=main.');
  });
});
