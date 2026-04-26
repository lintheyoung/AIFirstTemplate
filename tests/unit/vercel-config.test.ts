import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('vercel config', () => {
  it('pins hosted functions to the Singapore region', () => {
    const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
      regions?: string[];
    };

    expect(config.regions).toEqual(['sin1']);
  });
});
