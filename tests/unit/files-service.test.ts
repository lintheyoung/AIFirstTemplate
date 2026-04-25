import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlatformActor } from '../../lib/auth/actors';
import type { StorageAdapter } from '../../lib/storage/adapter';
import {
  createFileId,
  createStorageKey,
  createUploadIntent,
  normalizeVisibility,
  sanitizeFilename,
} from '../../lib/files/service';

const baseEnv = {
  APP_ENV: 'test',
  NEXT_PUBLIC_APP_URL: 'https://test.example.com',
  DATABASE_URL: 'postgres://user:pass@example.com:5432/app',
  CLERK_SECRET_KEY: 'sk_test_example',
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_example',
  R2_ACCOUNT_ID: 'account',
  R2_ACCESS_KEY_ID: 'access',
  R2_SECRET_ACCESS_KEY: 'secret',
  R2_BUCKET_NAME: 'aifirst-template-staging',
  R2_PUBLIC_BASE_URL: 'https://files-test.example.com',
  INNGEST_EVENT_KEY: 'event-key',
  INNGEST_SIGNING_KEY: 'signing-key',
};

const actor: PlatformActor = {
  actorType: 'user',
  actorId: 'user_123',
  workspaceId: 42,
  scopes: ['*'],
};

function stubBaseEnv() {
  for (const [key, value] of Object.entries(baseEnv)) {
    vi.stubEnv(key, value);
  }
}

describe('files service helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('creates stable file ids with the file prefix', () => {
    const id = createFileId(() => '12345678-1234-1234-1234-123456789abc');

    expect(id).toBe('file_12345678123412341234123456789abc');
  });

  it('creates workspace-scoped storage keys', () => {
    expect(
      createStorageKey({
        workspaceId: 42,
        fileId: 'file_abc',
        filename: 'Quarterly Report.pdf',
      }),
    ).toBe('ws/42/input/file_abc/Quarterly-Report.pdf');
  });

  it('falls back for reserved dot filenames', () => {
    expect(sanitizeFilename('.')).toBe('file');
    expect(sanitizeFilename('..')).toBe('file');
    expect(createStorageKey({ workspaceId: 42, fileId: 'file_abc', filename: '..' })).toBe(
      'ws/42/input/file_abc/file',
    );
  });

  it('defaults visibility to private', () => {
    expect(normalizeVisibility(undefined)).toBe('private');
    expect(normalizeVisibility('public')).toBe('public');
  });

  it('creates upload intents with a scoped key and private visibility by default', async () => {
    stubBaseEnv();

    const createUploadUrl = vi.fn<StorageAdapter['createUploadUrl']>().mockResolvedValue({
      url: 'https://upload.example.com/signed',
      headers: { 'content-type': 'application/pdf' },
    });
    const storage: StorageAdapter = {
      createUploadUrl,
      createDownloadUrl: vi.fn<StorageAdapter['createDownloadUrl']>(),
      publicUrl: vi.fn<StorageAdapter['publicUrl']>(),
    };

    const upload = await createUploadIntent({
      actor,
      input: {
        filename: 'Quarterly Report.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1234,
      },
      storage,
      storageBucket: 'aifirst-template-staging',
      uuidFactory: () => '12345678-1234-1234-1234-123456789abc',
    });

    expect(upload).toEqual({
      fileId: 'file_12345678123412341234123456789abc',
      uploadUrl: 'https://upload.example.com/signed',
      headers: { 'content-type': 'application/pdf' },
      visibility: 'private',
      storageKey:
        'ws/42/input/file_12345678123412341234123456789abc/Quarterly-Report.pdf',
      publicUrl: null,
    });
    expect(createUploadUrl).toHaveBeenCalledWith({
      bucket: 'aifirst-template-staging',
      key: 'ws/42/input/file_12345678123412341234123456789abc/Quarterly-Report.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1234,
    });
    expect(storage.publicUrl).not.toHaveBeenCalled();
  });

  it('returns a public url for public upload intents', async () => {
    stubBaseEnv();

    const storage: StorageAdapter = {
      createUploadUrl: vi.fn<StorageAdapter['createUploadUrl']>().mockResolvedValue({
        url: 'https://upload.example.com/signed',
        headers: { 'content-type': 'image/png' },
      }),
      createDownloadUrl: vi.fn<StorageAdapter['createDownloadUrl']>(),
      publicUrl: vi
        .fn<StorageAdapter['publicUrl']>()
        .mockReturnValue('https://cdn.example.com/file.png'),
    };

    const upload = await createUploadIntent({
      actor,
      input: {
        filename: 'file.png',
        mimeType: 'image/png',
        sizeBytes: 100,
        visibility: 'public',
      },
      storage,
      uuidFactory: () => '12345678-1234-1234-1234-123456789abc',
    });

    expect(upload.publicUrl).toBe('https://cdn.example.com/file.png');
    expect(storage.publicUrl).toHaveBeenCalledWith({
      key: 'ws/42/input/file_12345678123412341234123456789abc/file.png',
    });
  });

  it('supports fake storage without environment values', async () => {
    for (const key of Object.keys(baseEnv)) {
      vi.stubEnv(key, undefined);
    }

    const createUploadUrl = vi.fn<StorageAdapter['createUploadUrl']>().mockResolvedValue({
      url: 'https://upload.example.com/signed',
      headers: { 'content-type': 'text/plain' },
    });
    const storage: StorageAdapter = {
      createUploadUrl,
      createDownloadUrl: vi.fn<StorageAdapter['createDownloadUrl']>(),
      publicUrl: vi.fn<StorageAdapter['publicUrl']>(),
    };

    await createUploadIntent({
      actor,
      input: {
        filename: 'notes.txt',
        mimeType: 'text/plain',
        sizeBytes: 10,
      },
      storage,
      uuidFactory: () => '12345678-1234-1234-1234-123456789abc',
    });

    expect(createUploadUrl).toHaveBeenCalledWith(
      expect.objectContaining({ bucket: 'test-files' }),
    );
  });

  it('joins public object keys into the base URL pathname', async () => {
    vi.resetModules();
    for (const [key, value] of Object.entries({
      ...baseEnv,
      R2_PUBLIC_BASE_URL: 'https://files.example.com/assets/root?token=abc#section',
    })) {
      vi.stubEnv(key, value);
    }

    const { r2StorageAdapter } = await import('../../lib/storage/r2');

    expect(r2StorageAdapter.publicUrl({ key: 'ws/42/input/file_abc/report.pdf' })).toBe(
      'https://files.example.com/assets/root/ws/42/input/file_abc/report.pdf',
    );
  });

  it('imports the R2 adapter without requiring environment values', async () => {
    vi.resetModules();

    for (const key of Object.keys(baseEnv)) {
      vi.stubEnv(key, undefined);
    }

    await expect(import('../../lib/storage/r2')).resolves.toHaveProperty('r2StorageAdapter');
  });
});
