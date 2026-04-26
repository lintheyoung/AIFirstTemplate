import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { parse } from 'dotenv';
import type { AppEnvironment } from '../config/platform';
import { parseAppEnv } from '../lib/env/schema';

type DeployPreflightOptions = {
  root?: string;
  envFile: string;
  expectEnv?: AppEnvironment;
  expectRegion?: string;
  currentBranch?: string;
};

type VercelProject = {
  projectName?: string;
};

type VercelConfig = {
  regions?: unknown;
};

export type DeployPreflightResult = {
  status: 'ok';
  appEnv: AppEnvironment;
  appUrl: string;
  bucket: string;
  inngestEnv: string;
  region: string;
  vercelProject: string;
  warnings: string[];
};

const appEnvironments = ['dev', 'test', 'prod'] as const;

export function expectedInngestEnv(appEnv: AppEnvironment) {
  if (appEnv === 'prod') {
    return 'Production';
  }

  return appEnv;
}

function isAppEnvironment(value: string | undefined): value is AppEnvironment {
  return appEnvironments.includes(value as AppEnvironment);
}

function parseArgs(argv: string[]): DeployPreflightOptions {
  let envFile = '.env.local';
  let expectEnv: AppEnvironment | undefined;
  let expectRegion = 'sin1';

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--env-file') {
      envFile = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--expect-env') {
      const value = argv[index + 1];
      if (!isAppEnvironment(value)) {
        throw new Error('--expect-env must be one of dev, test, or prod.');
      }
      expectEnv = value;
      index += 1;
      continue;
    }

    if (arg === '--expect-region') {
      expectRegion = argv[index + 1];
      index += 1;
      continue;
    }

    envFile = arg;
  }

  return {
    envFile,
    expectEnv,
    expectRegion,
  };
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function resolveCurrentBranch(root: string) {
  try {
    return execSync('git branch --show-current', {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

export function runDeployPreflight(options: DeployPreflightOptions): DeployPreflightResult {
  const root = options.root ?? process.cwd();
  const envPath = join(root, options.envFile);
  const vercelConfigPath = join(root, 'vercel.json');
  const vercelProjectPath = join(root, '.vercel/project.json');
  const expectRegion = options.expectRegion ?? 'sin1';

  if (!existsSync(envPath)) {
    throw new Error(`Environment file does not exist: ${options.envFile}`);
  }

  if (!existsSync(vercelConfigPath)) {
    throw new Error('vercel.json is required so hosted functions have an explicit region.');
  }

  if (!existsSync(vercelProjectPath)) {
    throw new Error('.vercel/project.json is required. Run `vercel link` before deploy.');
  }

  const parsed = parseAppEnv(parse(readFileSync(envPath, 'utf8')));
  const expectedEnv = options.expectEnv ?? parsed.APP_ENV;

  if (parsed.APP_ENV !== expectedEnv) {
    throw new Error(
      `Expected APP_ENV=${expectedEnv} for ${options.envFile}, but found APP_ENV=${parsed.APP_ENV}.`,
    );
  }

  const expectedInngest = expectedInngestEnv(parsed.APP_ENV);
  if (parsed.INNGEST_ENV !== expectedInngest) {
    throw new Error(
      `Expected INNGEST_ENV=${expectedInngest} for APP_ENV=${parsed.APP_ENV}, but found INNGEST_ENV=${parsed.INNGEST_ENV}.`,
    );
  }

  const vercelConfig = readJson<VercelConfig>(vercelConfigPath);
  const regions = Array.isArray(vercelConfig.regions) ? vercelConfig.regions : [];
  if (!regions.includes(expectRegion)) {
    throw new Error(`vercel.json regions must include ${expectRegion}.`);
  }

  const vercelProject = readJson<VercelProject>(vercelProjectPath);
  const projectName = vercelProject.projectName ?? 'unknown';
  const currentBranch = options.currentBranch ?? resolveCurrentBranch(root);
  const warnings: string[] = [];

  if (parsed.APP_ENV === 'test' && currentBranch === 'main') {
    warnings.push(
      'Vercel cannot persist Preview environment variables on the production branch. Use a staging branch or pass one-off preview env values during deploy.',
    );
  }

  return {
    status: 'ok',
    appEnv: parsed.APP_ENV,
    appUrl: parsed.NEXT_PUBLIC_APP_URL,
    bucket: parsed.R2_BUCKET_NAME,
    inngestEnv: parsed.INNGEST_ENV,
    region: expectRegion,
    vercelProject: projectName,
    warnings,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = runDeployPreflight(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(result, null, 2));
}
