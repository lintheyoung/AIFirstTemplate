import { z } from 'zod';
import { projectConfig } from '../../config/project';

const appEnvSchema = z.object({
  APP_ENV: z.enum(['dev', 'test', 'prod']),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(1),
  R2_PUBLIC_BASE_URL: z.string().url(),
  INNGEST_EVENT_KEY: z.string().min(1),
  INNGEST_SIGNING_KEY: z.string().min(1),
  INNGEST_ENV: z.string().min(1),
});

export type AppEnv = z.infer<typeof appEnvSchema>;

export function parseAppEnv(input: NodeJS.ProcessEnv | Record<string, string | undefined>): AppEnv {
  const parsed = appEnvSchema.parse(input);
  const bucketName = parsed.R2_BUCKET_NAME.toLowerCase();

  if (parsed.APP_ENV === 'prod') {
    if (['staging', 'stage', 'test', 'dev'].some((unsafeName) => bucketName.includes(unsafeName))) {
      throw new Error('Production cannot use a staging storage bucket.');
    }

    if (parsed.R2_BUCKET_NAME !== projectConfig.storageBuckets.prod) {
      throw new Error('Production storage bucket must match projectConfig.storageBuckets.prod.');
    }
  }

  if (parsed.APP_ENV === 'test') {
    if (['prod', 'production'].some((unsafeName) => bucketName.includes(unsafeName))) {
      throw new Error('Test cannot use a production storage bucket.');
    }

    if (parsed.R2_BUCKET_NAME !== projectConfig.storageBuckets.test) {
      throw new Error('Test storage bucket must match projectConfig.storageBuckets.test.');
    }
  }

  return parsed;
}

let cachedEnv: AppEnv | undefined;

export function getAppEnv(): AppEnv {
  cachedEnv ??= parseAppEnv(process.env);
  return cachedEnv;
}

// Keep module imports safe in tests and tooling; validation happens on first property access.
export const env = new Proxy({} as AppEnv, {
  get(_target, property: keyof AppEnv) {
    return getAppEnv()[property];
  },
});
