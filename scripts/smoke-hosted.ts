import type { AppEnvironment } from '../config/platform';
import { expectedInngestEnv } from './deploy-preflight';

type SmokeCheckStatus = 'ok' | 'skipped';

type SmokeFetch = (url: string, init?: RequestInit) => Promise<Response>;

export type HostedSmokeOptions = {
  baseUrl: string;
  expectEnv: AppEnvironment;
  expectRegion?: string;
  clerkBearerToken?: string;
  fetcher?: SmokeFetch;
};

export type HostedSmokeResult = {
  status: 'ok';
  baseUrl: string;
  expectEnv: AppEnvironment;
  expectRegion: string;
  checks: {
    unauthenticatedApi: SmokeCheckStatus;
    inngest: SmokeCheckStatus;
    authenticatedMe: SmokeCheckStatus;
    authenticatedCapabilities: SmokeCheckStatus;
  };
};

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJson(response: Response, label: string) {
  try {
    return (await response.json()) as unknown;
  } catch (error) {
    throw new Error(`${label} returned invalid JSON.`, { cause: error });
  }
}

function assertVercelRegion(response: Response, expectRegion: string) {
  const vercelId = response.headers.get('x-vercel-id') ?? '';

  if (!vercelId.includes(expectRegion)) {
    throw new Error(`Expected x-vercel-id to include ${expectRegion}, but received ${vercelId}.`);
  }
}

function endpoint(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

async function checkUnauthenticatedApi(args: {
  baseUrl: string;
  expectRegion: string;
  fetcher: SmokeFetch;
}) {
  const response = await args.fetcher(endpoint(args.baseUrl, '/api/v1/me'), {
    headers: {
      'x-request-id': 'req_smoke_unauthenticated_me',
    },
  });
  assertVercelRegion(response, args.expectRegion);

  const body = await readJson(response, 'Unauthenticated /api/v1/me smoke');
  if (response.status !== 401 || !isObject(body) || !isObject(body.error)) {
    throw new Error('Unauthenticated /api/v1/me smoke did not return a normalized 401 error.');
  }

  if (body.error.code !== 'AUTH_UNAUTHORIZED') {
    throw new Error('Unauthenticated /api/v1/me smoke did not return AUTH_UNAUTHORIZED.');
  }
}

async function checkInngest(args: {
  baseUrl: string;
  expectEnv: AppEnvironment;
  expectRegion: string;
  fetcher: SmokeFetch;
}) {
  const response = await args.fetcher(endpoint(args.baseUrl, '/api/inngest'));
  assertVercelRegion(response, args.expectRegion);

  if (response.status !== 200) {
    throw new Error(`/api/inngest smoke failed with status ${response.status}.`);
  }

  const inngestEnv = response.headers.get('x-inngest-env');
  const expectedEnv = expectedInngestEnv(args.expectEnv);
  if (inngestEnv !== expectedEnv) {
    throw new Error(`Expected x-inngest-env=${expectedEnv}, but received ${inngestEnv}.`);
  }

  const body = await readJson(response, '/api/inngest smoke');
  if (
    !isObject(body) ||
    body.has_event_key !== true ||
    body.has_signing_key !== true ||
    typeof body.function_count !== 'number' ||
    body.function_count < 1
  ) {
    throw new Error('/api/inngest smoke returned an unexpected sync shape.');
  }
}

function bearerHeaders(token: string) {
  const headers = new Headers();
  headers.set('authorization', `Bearer ${token}`);
  headers.set('x-request-id', 'req_smoke_authenticated');
  return headers;
}

async function checkAuthenticatedMe(args: {
  baseUrl: string;
  expectRegion: string;
  clerkBearerToken: string;
  fetcher: SmokeFetch;
}) {
  const response = await args.fetcher(endpoint(args.baseUrl, '/api/v1/me'), {
    headers: bearerHeaders(args.clerkBearerToken),
  });
  assertVercelRegion(response, args.expectRegion);

  if (response.status !== 200) {
    throw new Error(`Authenticated /api/v1/me smoke failed with status ${response.status}.`);
  }

  const body = await readJson(response, 'Authenticated /api/v1/me smoke');
  if (
    !isObject(body) ||
    !isObject(body.data) ||
    body.data.actor_type !== 'user' ||
    typeof body.data.actor_id !== 'string'
  ) {
    throw new Error('Authenticated /api/v1/me smoke returned an unexpected actor shape.');
  }
}

async function checkAuthenticatedCapabilities(args: {
  baseUrl: string;
  expectRegion: string;
  clerkBearerToken: string;
  fetcher: SmokeFetch;
}) {
  const response = await args.fetcher(endpoint(args.baseUrl, '/api/v1/capabilities'), {
    headers: bearerHeaders(args.clerkBearerToken),
  });
  assertVercelRegion(response, args.expectRegion);

  if (response.status !== 200) {
    throw new Error(
      `Authenticated /api/v1/capabilities smoke failed with status ${response.status}.`,
    );
  }

  const body = await readJson(response, 'Authenticated /api/v1/capabilities smoke');
  if (!isObject(body) || !isObject(body.data) || !Array.isArray(body.data.capabilities)) {
    throw new Error('Authenticated /api/v1/capabilities smoke returned an unexpected shape.');
  }

  const hasEchoCapability = body.data.capabilities.some(
    (capability) =>
      isObject(capability) &&
      capability.name === 'example.echo' &&
      capability.provider === 'echo',
  );

  if (!hasEchoCapability) {
    throw new Error('Authenticated /api/v1/capabilities smoke did not include example.echo.');
  }
}

export async function runHostedSmoke(options: HostedSmokeOptions): Promise<HostedSmokeResult> {
  const expectRegion = options.expectRegion ?? 'sin1';
  const fetcher = options.fetcher ?? fetch;
  const checks: HostedSmokeResult['checks'] = {
    unauthenticatedApi: 'skipped',
    inngest: 'skipped',
    authenticatedMe: 'skipped',
    authenticatedCapabilities: 'skipped',
  };

  await checkUnauthenticatedApi({
    baseUrl: options.baseUrl,
    expectRegion,
    fetcher,
  });
  checks.unauthenticatedApi = 'ok';

  await checkInngest({
    baseUrl: options.baseUrl,
    expectEnv: options.expectEnv,
    expectRegion,
    fetcher,
  });
  checks.inngest = 'ok';

  if (options.clerkBearerToken) {
    await checkAuthenticatedMe({
      baseUrl: options.baseUrl,
      expectRegion,
      clerkBearerToken: options.clerkBearerToken,
      fetcher,
    });
    checks.authenticatedMe = 'ok';

    await checkAuthenticatedCapabilities({
      baseUrl: options.baseUrl,
      expectRegion,
      clerkBearerToken: options.clerkBearerToken,
      fetcher,
    });
    checks.authenticatedCapabilities = 'ok';
  }

  return {
    status: 'ok',
    baseUrl: options.baseUrl,
    expectEnv: options.expectEnv,
    expectRegion,
    checks,
  };
}

function parseEnvOptions(): HostedSmokeOptions {
  const baseUrl = process.env.SMOKE_BASE_URL;
  const expectEnv = process.env.SMOKE_EXPECT_ENV;

  if (!baseUrl) {
    throw new Error('SMOKE_BASE_URL is required.');
  }

  if (expectEnv !== 'dev' && expectEnv !== 'test' && expectEnv !== 'prod') {
    throw new Error('SMOKE_EXPECT_ENV must be one of dev, test, or prod.');
  }

  return {
    baseUrl,
    expectEnv,
    expectRegion: process.env.SMOKE_EXPECT_REGION ?? 'sin1',
    clerkBearerToken: process.env.SMOKE_CLERK_BEARER_TOKEN,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await runHostedSmoke(parseEnvOptions());
  console.log(JSON.stringify(result, null, 2));
}
