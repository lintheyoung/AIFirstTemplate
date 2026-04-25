import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { parse } from 'dotenv';
import type { AppEnvironment } from '../config/platform';
import { parseAppEnv } from '../lib/env/schema';

const appEnvironments = ['dev', 'test', 'prod'] as const;

function parseArgs(argv: string[]) {
  let path = '.env.local';
  let expectedEnv: AppEnvironment | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--expect-env') {
      const value = argv[index + 1];
      if (!isAppEnvironment(value)) {
        throw new Error('--expect-env must be one of dev, test, or prod.');
      }
      expectedEnv = value;
      index += 1;
      continue;
    }

    path = arg;
  }

  return { path, expectedEnv: expectedEnv ?? inferExpectedEnv(path) };
}

function isAppEnvironment(value: string | undefined): value is AppEnvironment {
  return appEnvironments.includes(value as AppEnvironment);
}

function inferExpectedEnv(path: string): AppEnvironment | undefined {
  const fileName = basename(path).toLowerCase();

  if (fileName.includes('production') || fileName.includes('prod')) {
    return 'prod';
  }

  if (fileName.includes('test')) {
    return 'test';
  }

  if (fileName === '.env.example' || fileName.includes('dev')) {
    return 'dev';
  }

  return undefined;
}

const { path, expectedEnv } = parseArgs(process.argv.slice(2));
const parsed = parseAppEnv(parse(readFileSync(path, 'utf8')));

if (expectedEnv && parsed.APP_ENV !== expectedEnv) {
  throw new Error(`Expected APP_ENV=${expectedEnv} for ${path}, but found APP_ENV=${parsed.APP_ENV}.`);
}

console.log(
  JSON.stringify(
    {
      status: 'ok',
      appEnv: parsed.APP_ENV,
      appUrl: parsed.NEXT_PUBLIC_APP_URL,
      bucket: parsed.R2_BUCKET_NAME,
    },
    null,
    2,
  ),
);
