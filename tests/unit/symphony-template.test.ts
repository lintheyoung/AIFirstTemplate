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
      'symphony/scripts/start_backend_symphony.sh',
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

    expect(readme).toContain('SYMPHONY_ELIXIR_ROOT');
    expect(readme).toContain('External Runtime Setup');
    expect(readme).toContain('bin/symphony');
    expect(readme).toContain('mise exec -- mix escript.build');
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
        'MAX_CONCURRENT_AGENTS=1',
        'MAX_TURNS=25',
        'CODEX_COMMAND=codex',
        'SERVER_PORT=4012',
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
    expect(rendered).toContain('Base branch for PRs: template');
    expect(rendered).not.toMatch(/__[A-Z0-9_]+__/);
  });

  it('does not carry private product-specific Symphony references into the starter package', () => {
    const files = [
      'symphony/.env.example',
      'symphony/profiles/aifirst-template.env.example',
      'symphony/templates/WORKFLOW.linear.template.md',
      'symphony/templates/LINEAR_ISSUE_TEMPLATE.md',
      'symphony/scripts/bootstrap_workflow.py',
      'symphony/scripts/start_backend_symphony.sh',
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
