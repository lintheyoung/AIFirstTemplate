import { describe, expect, it } from 'vitest';
import React from 'react';
import type { ReactNode } from 'react';
import DashboardPage from '../../app/(dashboard)/dashboard/page';
import ApiKeysPage from '../../app/(dashboard)/dashboard/api-keys/page';
import FilesPage from '../../app/(dashboard)/dashboard/files/page';
import JobsPage from '../../app/(dashboard)/dashboard/jobs/page';

Object.assign(globalThis, { React });

type ReactTree = ReactNode | Iterable<ReactNode>;

function textContent(node: ReactTree): string {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return '';
  }

  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(textContent).join(' ');
  }

  if (typeof node === 'object' && Symbol.iterator in node) {
    return Array.from(node as Iterable<ReactNode>).map(textContent).join(' ');
  }

  if (typeof node === 'object' && 'props' in node) {
    const element = node as { props: { children?: ReactNode } };
    return textContent(element.props.children ?? '').replace(/\s+/g, ' ').trim();
  }

  return '';
}

describe('dashboard pages', () => {
  it('renders the dashboard overview heading and starter metrics', () => {
    const text = textContent(DashboardPage());

    expect(text).toContain('Control plane overview');
    expect(text).toContain('Workspaces 1');
    expect(text).toContain('API keys 0');
    expect(text).toContain('Files 0');
    expect(text).toContain('Jobs 0');
  });

  it('renders the jobs empty state', () => {
    const text = textContent(JobsPage());

    expect(text).toContain('Jobs');
    expect(text).toContain('Submitted jobs and provider attempts will appear here.');
  });

  it('renders the files empty state', () => {
    const text = textContent(FilesPage());

    expect(text).toContain('Files');
    expect(text).toContain('Uploaded source files and derived artifacts will appear here.');
  });

  it('renders the api keys empty state', () => {
    const text = textContent(ApiKeysPage());

    expect(text).toContain('API keys');
    expect(text).toContain('Machine credentials for API clients and agents will appear here.');
  });
});
