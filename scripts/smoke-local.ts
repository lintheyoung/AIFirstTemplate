const baseUrl = process.env.SMOKE_BASE_URL ?? 'http://localhost:3024';

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJson(response: Response, label: string) {
  try {
    return (await response.json()) as unknown;
  } catch (error) {
    throw new Error(`${label} smoke returned invalid JSON.`, { cause: error });
  }
}

async function readErrorBody(response: Response) {
  const body = (await response.text()).trim();

  if (!body) {
    return '';
  }

  return body.length > 1_000 ? `${body.slice(0, 1_000)}...` : body;
}

async function fetchJson(url: string, init: RequestInit, label: string) {
  const response = await fetch(url, init);

  if (!response.ok) {
    const body = await readErrorBody(response);
    const bodyDetail = body ? ` Response body: ${body}` : '';

    throw new Error(`${label} smoke failed with status ${response.status}.${bodyDetail}`);
  }

  return readJson(response, label);
}

function assertCapabilities(body: unknown) {
  if (!isObject(body) || !isObject(body.data) || !Array.isArray(body.data.capabilities)) {
    throw new Error('Capabilities smoke returned an unexpected response shape.');
  }

  const hasEchoCapability = body.data.capabilities.some(
    (capability) =>
      isObject(capability) &&
      capability.name === 'example.echo' &&
      capability.provider === 'echo',
  );

  if (!hasEchoCapability) {
    throw new Error('Capabilities smoke did not include the example.echo capability.');
  }
}

function assertEchoJob(body: unknown) {
  if (!isObject(body) || !isObject(body.data) || !isObject(body.data.job)) {
    throw new Error('Job smoke returned an unexpected response shape.');
  }

  const { job } = body.data;

  if (
    job.capability_name !== 'example.echo' ||
    job.provider_name !== 'echo' ||
    job.status !== 'succeeded'
  ) {
    throw new Error('Job smoke did not return a succeeded example.echo job.');
  }

  if (!isObject(job.result) || !isObject(job.result.echo) || job.result.echo.message !== 'smoke') {
    throw new Error('Job smoke did not echo the expected payload.');
  }

  return job;
}

async function main() {
  const capabilitiesBody = await fetchJson(
    `${baseUrl}/api/v1/capabilities`,
    {
      headers: { 'x-request-id': 'req_smoke_capabilities' },
    },
    'Capabilities',
  );
  assertCapabilities(capabilitiesBody);

  const jobsBody = await fetchJson(
    `${baseUrl}/api/v1/jobs`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-request-id': 'req_smoke_job',
      },
      body: JSON.stringify({
        capability_name: 'example.echo',
        provider_name: 'echo',
        execution_mode: 'sync',
        input: { message: 'smoke' },
      }),
    },
    'Job',
  );
  const job = assertEchoJob(jobsBody);

  console.log(JSON.stringify({ status: 'ok', job }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
