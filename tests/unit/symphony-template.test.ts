import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function readProjectFile(path: string) {
  return readFileSync(join(root, path), 'utf8');
}

describe('symphony template control package', () => {
  it('includes project-level Symphony files without vendoring the runtime', () => {
    const requiredFiles = [
      'symphony/.env.example',
      'symphony/profiles/aifirst-template.env.example',
      'symphony/templates/WORKFLOW.linear.template.md',
      'symphony/templates/LINEAR_ISSUE_TEMPLATE.md',
      'symphony/scripts/bootstrap_workflow.py',
      'symphony/scripts/bootstrap_runtime.sh',
      'symphony/scripts/opencode_review_wrapper.py',
      'symphony/scripts/run_opencode_review.py',
      'symphony/scripts/start_backend_symphony.sh',
      'symphony/runtime.lock',
      'symphony/docs/linear-state-machine.md',
      'symphony/README.md',
    ];

    for (const file of requiredFiles) {
      expect(existsSync(join(root, file))).toBe(true);
    }

    expect(existsSync(join(root, 'symphony/elixir'))).toBe(false);
  });

  it('documents external Symphony Elixir runtime setup', () => {
    const readme = readProjectFile('symphony/README.md');
    const runtimeLock = readProjectFile('symphony/runtime.lock');
    const bootstrapScript = readProjectFile('symphony/scripts/bootstrap_runtime.sh');
    const startScript = readProjectFile('symphony/scripts/start_backend_symphony.sh');

    expect(readme).toContain('SYMPHONY_ELIXIR_ROOT');
    expect(readme).toContain('Runtime Bootstrap');
    expect(readme).toContain('bin/symphony');
    expect(readme).toContain('mise exec -- mix escript.build');
    expect(runtimeLock).toContain('SYMPHONY_RUNTIME_REPO=https://github.com/openai/symphony.git');
    expect(runtimeLock).toContain('SYMPHONY_RUNTIME_REF=');
    expect(bootstrapScript).toContain('SYMPHONY_RUNTIME_CACHE_DIR');
    expect(bootstrapScript).toContain('git clone');
    expect(bootstrapScript).toContain('mise trust');
    expect(bootstrapScript).toContain('mix escript.build');
    expect(startScript).toContain('bootstrap_runtime.sh');
  });

  it('documents multi-instance Symphony configuration', () => {
    const readme = readProjectFile('symphony/README.md');
    const script = readProjectFile('symphony/scripts/start_backend_symphony.sh');

    expect(readme).toContain('Run Multiple Symphony Instances');
    expect(readme).toContain('SYMPHONY_PROFILE=pest-prod');
    expect(readme).toContain('SERVER_PORT=4013');
    expect(readme).toContain('WORKSPACE_ROOT');
    expect(readme).toContain('PROJECT_NAME');
    expect(script).toContain('WORKFLOW_SAFE_PROFILE');
    expect(script).toContain('WORKFLOW.${WORKFLOW_SAFE_PROFILE}.${SERVER_PORT}.generated.md');
  });

  it('documents Linear intake environment variables', () => {
    const readme = readProjectFile('symphony/README.md');
    const sharedEnv = readProjectFile('symphony/.env.example');
    const profileEnv = readProjectFile('symphony/profiles/aifirst-template.env.example');

    expect(readme).toContain('Linear Intake Environment');
    expect(readme).toContain('LINEAR_API_KEY');
    expect(readme).toContain('LINEAR_PROJECT_SLUG');
    expect(readme).toContain('TRACKER_LABEL');
    expect(readme).toContain('OPENCODE_REVIEW_REQUIRED');
    expect(readme).toContain('OPENCODE_COMMAND');
    expect(readme).toContain('EXTERNAL_CODE_REVIEW_REQUIRED');
    expect(readme).toContain('EXTERNAL_CODE_REVIEW_CHECKS');
    expect(readme).toContain('HUMAN_APPROVAL_PHRASE');
    expect(readme).toContain('Todo');
    expect(readme).toContain('In Progress');
    expect(sharedEnv).toContain('Linear personal API key');
    expect(profileEnv).toContain('Linear project slug');
    expect(profileEnv).toContain('Linear label');
    expect(profileEnv).toContain('OPENCODE_REVIEW_REQUIRED=true');
    expect(profileEnv).toContain('OPENCODE_COMMAND=opencode');
    expect(profileEnv).toContain('EXTERNAL_CODE_REVIEW_REQUIRED=false');
    expect(profileEnv).toContain('HUMAN_APPROVAL_PHRASE=');
  });

  it('requires explicit review gates before Symphony merges', () => {
    const workflow = readProjectFile('symphony/templates/WORKFLOW.linear.template.md');

    expect(workflow).toContain('Local opencode review is the default automated code review gate');
    expect(workflow).toContain('run_opencode_review.py round1');
    expect(workflow).toContain('run_opencode_review.py round2');
    expect(workflow).toContain('gh pr review <number> --comment');
    expect(workflow).toContain('## Opencode Review');
    expect(workflow).toContain('Optional external GitHub review policy');
    expect(workflow).toContain('Human approval is explicit only when');
    expect(workflow).toContain('If the issue is moved to `Merging` without that phrase');
  });

  it('includes local opencode review helper scripts', () => {
    const runner = readProjectFile('symphony/scripts/run_opencode_review.py');
    const wrapper = readProjectFile('symphony/scripts/opencode_review_wrapper.py');

    expect(runner).toContain('ROUND_FOCUS');
    expect(runner).toContain('Return JSON only');
    expect(runner).toContain('git", "diff"');
    expect(runner).toContain('opencode_review_wrapper.py');
    expect(wrapper).toContain('OPENCODE_COMMAND');
    expect(wrapper).toContain('OPENCODE_REVIEW_TIMEOUT_SECONDS');
    expect(wrapper).toContain('normalize_opencode_stdout');
  });

  it('gives Symphony executable API issue fields', () => {
    const issueTemplate = readProjectFile('symphony/templates/LINEAR_ISSUE_TEMPLATE.md');

    expect(issueTemplate).toContain('Change type');
    expect(issueTemplate).toContain('API route');
    expect(issueTemplate).toContain('Capability');
    expect(issueTemplate).toContain('Provider');
    expect(issueTemplate).toContain('Endpoint or capability name');
    expect(issueTemplate).toContain('Auth requirement');
    expect(issueTemplate).toContain('Request shape');
    expect(issueTemplate).toContain('Response shape');
    expect(issueTemplate).toContain('Files expected to touch');
    expect(issueTemplate).toContain('Non-goals');
    expect(issueTemplate).toContain('API Contract');
    expect(issueTemplate).toContain('docs/pestgg-api-design-manual.md');
    expect(issueTemplate).toContain('API category');
    expect(issueTemplate).toContain('Workspace rule');
    expect(issueTemplate).toContain('Success status and response fields');
    expect(issueTemplate).toContain('Async behavior');
    expect(issueTemplate).toContain('Mobile client impact');
  });

  it('instructs Symphony to follow API and provider playbooks', () => {
    const workflow = readProjectFile('symphony/templates/WORKFLOW.linear.template.md');

    expect(workflow).toContain('docs/pestgg-api-design-manual.md');
    expect(workflow).toContain('docs/api-authoring-playbook.md');
    expect(workflow).toContain('docs/tool-authoring-playbook.md');
    expect(workflow).toContain('docs/provider-authoring-playbook.md');
    expect(workflow).toContain('API work rules');
    expect(workflow).toContain('requireClerkActor()');
    expect(workflow).toContain('normalized API response envelope');
    expect(workflow).toContain('tests/integration/api-v1-routes.test.ts');
    expect(workflow).toContain('Endpoint or capability');
    expect(workflow).toContain('API Contract block');
    expect(workflow).toContain('API JSON fields use `snake_case`');
    expect(workflow).toContain('Long-running provider work must use jobs and Inngest');
    expect(workflow).toContain('/api/webhooks/<provider>/<event>');
    expect(workflow).toContain('Manual reviewed: yes / not applicable');
    expect(workflow).toContain('Contract impact: method/path/auth/workspace/request/response/errors/async');
    expect(workflow).toContain('If API-affecting work violates `docs/pestgg-api-design-manual.md`');
  });

  it('documents the Symphony API design gate for operators and state transitions', () => {
    const readme = readProjectFile('symphony/README.md');
    const stateMachine = readProjectFile('symphony/docs/linear-state-machine.md');

    expect(readme).toContain('API Design Gate');
    expect(readme).toContain('../docs/pestgg-api-design-manual.md');
    expect(readme).toContain('contract is missing or vague');
    expect(readme).toContain('conflicts with the API manual');
    expect(readme).toContain('should go to `Rework`');
    expect(stateMachine).toContain('API-affecting work must follow `docs/pestgg-api-design-manual.md`');
    expect(stateMachine).toContain('changes `/api/v1`, capabilities, providers, Inngest jobs, or webhooks');
  });

  it('renders the Linear workflow from shared and profile env files', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'starter-symphony-'));
    const sharedEnv = join(workspace, '.env.local');
    const profileEnv = join(workspace, 'aifirst-template.env.local');
    const output = join(workspace, 'WORKFLOW.generated.md');

    writeFileSync(
      sharedEnv,
      [
        'WORKSPACE_ROOT=/tmp/aifirst-template-workspaces',
        'SYMPHONY_CONTROL_ROOT=/tmp/aifirst-template-control/symphony',
        'MAX_CONCURRENT_AGENTS=1',
        'MAX_TURNS=25',
        'CODEX_COMMAND=codex',
        'SERVER_PORT=4012',
        'OPENCODE_COMMAND=opencode',
        'OPENCODE_REVIEW_TIMEOUT_SECONDS=180',
      ].join('\n'),
    );
    writeFileSync(
      profileEnv,
      [
        'PROJECT_NAME="Starter Symphony"',
        'LINEAR_PROJECT_SLUG=starter-project',
        'TRACKER_LABEL=aifirst-template',
        'TARGET_REPO_NAME=aifirst-template',
        'TARGET_REPO_URL=https://github.com/example/aifirst-template.git',
        'TARGET_REPO_BASE_BRANCH=template',
      ].join('\n'),
    );

    execFileSync(
      'python3',
      [
        join(root, 'symphony/scripts/bootstrap_workflow.py'),
        '--template',
        join(root, 'symphony/templates/WORKFLOW.linear.template.md'),
        '--output',
        output,
        '--env-file',
        sharedEnv,
        '--env-file',
        profileEnv,
      ],
      { stdio: 'pipe' },
    );

    const rendered = readFileSync(output, 'utf8');

    expect(rendered).toContain('project_slug: "starter-project"');
    expect(rendered).toContain('label: "aifirst-template"');
    expect(rendered).toContain('git clone --depth 1 --branch template');
    expect(rendered).toContain('Symphony control root: /tmp/aifirst-template-control/symphony');
    expect(rendered).toContain('Integration branch for PRs: template');
    expect(rendered).toContain('Local opencode review required: true');
    expect(rendered).toContain('Local opencode command: opencode');
    expect(rendered).toContain('Optional external GitHub review checks or statuses required: false');
    expect(rendered).toContain('Optional external GitHub review check/status names:');
    expect(rendered).toContain('/tmp/aifirst-template-control/symphony/scripts/run_opencode_review.py round1');
    expect(rendered).toContain('Human approval phrase: Human Approval: merge approved');
    expect(rendered).not.toMatch(/__[A-Z0-9_]+__/);
  });

  it('does not carry private product-specific Symphony references into the starter package', () => {
    const files = [
      'symphony/.env.example',
      'symphony/profiles/aifirst-template.env.example',
      'symphony/templates/WORKFLOW.linear.template.md',
      'symphony/templates/LINEAR_ISSUE_TEMPLATE.md',
      'symphony/scripts/bootstrap_workflow.py',
      'symphony/scripts/bootstrap_runtime.sh',
      'symphony/scripts/opencode_review_wrapper.py',
      'symphony/scripts/run_opencode_review.py',
      'symphony/scripts/start_backend_symphony.sh',
      'symphony/runtime.lock',
      'symphony/docs/linear-state-machine.md',
      'symphony/README.md',
    ];
    const privateReferencePattern = new RegExp(
      [
        ['Tool', 'ist'].join(''),
        ['tooli', 'st'].join('.'),
        ['tool', 'ist'].join(''),
        ['lin', 'deyoung'].join(''),
        ['IOT', 'Agent'].join(''),
      ].join('|'),
    );

    for (const file of files) {
      const text = readProjectFile(file);
      expect(text).not.toMatch(privateReferencePattern);
    }
  });
});
