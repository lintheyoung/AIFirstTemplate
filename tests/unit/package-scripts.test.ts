import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('package scripts', () => {
  it('includes local smoke and verification scripts', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts: Record<string, string>;
    };

    expect(pkg.scripts['smoke:local']).toBe('tsx scripts/smoke-local.ts');
    expect(pkg.scripts.verify).toBe(
      'npm run typecheck && npm run lint && npm test && npm run check:env-contract -- .env.test.example',
    );
  });
});
