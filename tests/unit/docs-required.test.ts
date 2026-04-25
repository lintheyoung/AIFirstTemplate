import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>;
};

const requiredDocs = [
  {
    path: 'README.md',
    requiredTerms: ['docs/release-playbook.md', 'npm run check:env-contract', 'example.echo'],
  },
  {
    path: 'docs/new-project-guide.md',
    requiredTerms: ['config/project.ts', '.env.example', 'dev', 'test', 'prod'],
  },
  {
    path: 'docs/environment-runbook.md',
    requiredTerms: ['npm run check:env-contract', '.env.test.example', '.env.production.example'],
  },
  {
    path: 'docs/release-playbook.md',
    requiredTerms: [
      'npm test',
      'npm run typecheck',
      'npm run lint',
      'npm run build',
      'requireDemoActor()',
      'pre-production adoption task',
      'runJobInline()',
      'queue smoke is required only after background execution is wired',
    ],
  },
  {
    path: 'docs/tool-authoring-playbook.md',
    requiredTerms: ['/api/v1/capabilities', '/api/v1/jobs', 'example.echo', 'example.file_transform'],
  },
  {
    path: 'docs/provider-authoring-playbook.md',
    requiredTerms: ['lib/providers/types.ts', 'echo', 'example-transform'],
  },
] as const;

function readProjectFile(path: string) {
  return readFileSync(join(root, path), 'utf8');
}

function normalizeWhitespace(text: string) {
  return text.replace(/\s+/g, ' ');
}

function findMarkdownLinks(text: string) {
  return Array.from(text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g), (match) => match[1]).filter(
    (href) => !href.includes('://') && !href.startsWith('#'),
  );
}

function findDocumentedNpmScripts(text: string) {
  return Array.from(text.matchAll(/\bnpm run ([\w:-]+)/g), (match) => match[1]);
}

function findDocumentedEnvExamples(text: string) {
  return Array.from(text.matchAll(/`(\.env[.\w-]*\.example)`/g), (match) => match[1]);
}

function parseCapabilitiesFromRoute() {
  const routeText = readProjectFile('app/api/v1/capabilities/route.ts');
  const capabilityBlocks = routeText.matchAll(
    /name: '([^']+)',\s+provider: '([^']+)',\s+execution_modes: \[([^\]]+)\]/g,
  );

  return Array.from(capabilityBlocks, (match) => ({
    name: match[1],
    provider: match[2],
    executionModes: Array.from(match[3].matchAll(/'([^']+)'/g), (mode) => mode[1]),
  }));
}

describe('required docs', () => {
  it.each(requiredDocs)('$path exists and covers required starter guardrails', (doc) => {
    const absolute = join(root, doc.path);

    expect(existsSync(absolute)).toBe(true);

    const text = readProjectFile(doc.path);
    const normalizedText = normalizeWhitespace(text);

    expect(text.length).toBeGreaterThan(200);

    for (const term of doc.requiredTerms) {
      expect(normalizedText).toContain(term);
    }
  });

  it('keeps documented markdown links pointing to existing repo files', () => {
    for (const doc of requiredDocs) {
      const text = readProjectFile(doc.path);
      const links = findMarkdownLinks(text);

      for (const link of links) {
        expect(existsSync(join(root, link))).toBe(true);
      }
    }
  });

  it('keeps documented npm scripts backed by package.json', () => {
    for (const doc of requiredDocs) {
      const text = readProjectFile(doc.path);
      const scripts = findDocumentedNpmScripts(text);

      for (const script of scripts) {
        expect(packageJson.scripts[script]).toBeDefined();
      }
    }
  });

  it('keeps documented env example files present', () => {
    for (const doc of requiredDocs) {
      const text = readProjectFile(doc.path);
      const envExamples = findDocumentedEnvExamples(text);

      for (const envExample of envExamples) {
        expect(existsSync(join(root, envExample))).toBe(true);
      }
    }
  });

  it('keeps documented capabilities and providers aligned with the API route', () => {
    const capabilitiesDoc = readProjectFile('docs/tool-authoring-playbook.md');
    const releaseDoc = readProjectFile('docs/release-playbook.md');
    const capabilities = parseCapabilitiesFromRoute();

    expect(capabilities).toHaveLength(2);

    for (const capability of capabilities) {
      expect(capabilitiesDoc).toContain(capability.name);
      expect(capabilitiesDoc).toContain(capability.provider);
      expect(releaseDoc).toContain(capability.name);
      expect(releaseDoc).toContain(capability.provider);

      for (const mode of capability.executionModes) {
        expect(capabilitiesDoc).toContain(mode);
      }
    }
  });
});
