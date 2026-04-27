import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlatformActor } from '../../lib/auth/actors';
import type { FileRepository } from '../../lib/files/repository';
import type { StorageAdapter } from '../../lib/storage/adapter';
import {
  completeUploadIntent,
  createFileId,
  createGeneratedImageFromUrl,
  createStorageKey,
  createUploadIntent,
  normalizeVisibility,
  sanitizeFilename,
} from '../../lib/files/service';

const baseEnv = {
  APP_ENV: 'test',
  NEXT_PUBLIC_APP_URL: 'https://test.app.pest.gg',
  DATABASE_URL: 'postgres://user:pass@example.com:5432/app',
  CLERK_SECRET_KEY: 'sk_test_example',
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_example',
  R2_ACCOUNT_ID: 'account',
  R2_ACCESS_KEY_ID: 'access',
  R2_SECRET_ACCESS_KEY: 'secret',
  R2_BUCKET_NAME: 'pest-gg-app-staging',
  R2_PUBLIC_BASE_URL: 'https://files-test.app.pest.gg',
  INNGEST_EVENT_KEY: 'event-key',
  INNGEST_SIGNING_KEY: 'signing-key',
  INNGEST_ENV: 'test',
  KIE_API_KEY: 'kie_test_key',
  KIE_CALLBACK_BASE_URL: 'https://example.test',
  KIE_WEBHOOK_HMAC_KEY: 'kie_hmac_key',
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

function createFakeRepository(overrides: Partial<FileRepository> = {}): FileRepository {
  return {
    createPendingUpload: vi.fn<FileRepository['createPendingUpload']>(),
    markUploaded: vi.fn<FileRepository['markUploaded']>(),
    getById: vi.fn<FileRepository['getById']>(),
    createGeneratedFile: vi.fn<FileRepository['createGeneratedFile']>(),
    ...overrides,
  };
}

function fakeFileRecord(overrides: { id?: string; workspaceId?: number; status?: string } = {}) {
  return {
    id: overrides.id ?? 'file_test',
    workspaceId: overrides.workspaceId ?? actor.workspaceId,
    status: overrides.status ?? 'pending_upload',
  } as Awaited<ReturnType<FileRepository['getById']>>;
}

function expectFileNotFound(promise: Promise<unknown>) {
  return expect(promise).rejects.toMatchObject({
    code: 'RESOURCE_NOT_FOUND',
    status: 404,
    message: 'File was not found.',
  });
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
      putObject: vi.fn<StorageAdapter['putObject']>(),
      publicUrl: vi.fn<StorageAdapter['publicUrl']>(),
    };

    const upload = await createUploadIntent({
      actor,
      input: {
        filename: 'Quarterly Report.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1234,
      },
      repository: createFakeRepository(),
      storage,
      storageBucket: 'pest-gg-app-staging',
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
      bucket: 'pest-gg-app-staging',
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
      putObject: vi.fn<StorageAdapter['putObject']>(),
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
      repository: createFakeRepository(),
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
      putObject: vi.fn<StorageAdapter['putObject']>(),
      publicUrl: vi.fn<StorageAdapter['publicUrl']>(),
    };

    await createUploadIntent({
      actor,
      input: {
        filename: 'notes.txt',
        mimeType: 'text/plain',
        sizeBytes: 10,
      },
      repository: createFakeRepository(),
      storage,
      uuidFactory: () => '12345678-1234-1234-1234-123456789abc',
    });

    expect(createUploadUrl).toHaveBeenCalledWith(
      expect.objectContaining({ bucket: 'test-files' }),
    );
  });

  it('persists a pending upload record before returning an upload intent', async () => {
    stubBaseEnv();

    const createUploadUrl = vi.fn<StorageAdapter['createUploadUrl']>().mockResolvedValue({
      url: 'https://upload.example.com/signed',
      headers: { 'content-type': 'image/jpeg' },
    });
    const storage: StorageAdapter = {
      createUploadUrl,
      createDownloadUrl: vi.fn<StorageAdapter['createDownloadUrl']>(),
      putObject: vi.fn<StorageAdapter['putObject']>(),
      publicUrl: vi.fn<StorageAdapter['publicUrl']>(),
    };
    const createPendingUpload = vi.fn<FileRepository['createPendingUpload']>();
    const repository: FileRepository = {
      createPendingUpload,
      markUploaded: vi.fn<FileRepository['markUploaded']>(),
      getById: vi.fn<FileRepository['getById']>(),
      createGeneratedFile: vi.fn<FileRepository['createGeneratedFile']>(),
    };

    const upload = await createUploadIntent({
      actor,
      input: {
        filename: 'Product Shot.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 5678,
        visibility: 'public',
      },
      repository,
      storage,
      storageBucket: 'uploads',
      uuidFactory: () => '12345678-1234-1234-1234-123456789abc',
    });

    expect(createPendingUpload).toHaveBeenCalledBefore(createUploadUrl);
    expect(createPendingUpload).toHaveBeenCalledWith({
      id: 'file_12345678123412341234123456789abc',
      workspaceId: 42,
      filename: 'Product Shot.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 5678,
      storageProvider: 'r2',
      storageBucket: 'uploads',
      storageKey: 'ws/42/input/file_12345678123412341234123456789abc/Product-Shot.jpg',
      visibility: 'public',
      status: 'pending_upload',
      uploadedByType: 'user',
      uploadedById: 'user_123',
    });
    expect(upload.fileId).toBe('file_12345678123412341234123456789abc');
  });

  it('completes same-workspace upload intents', async () => {
    const repository = createFakeRepository({
      getById: vi.fn<FileRepository['getById']>().mockResolvedValue(fakeFileRecord()),
      markUploaded: vi
        .fn<FileRepository['markUploaded']>()
        .mockResolvedValue(fakeFileRecord({ status: 'uploaded' })),
    });

    await expect(
      completeUploadIntent({
        actor,
        fileId: 'file_test',
        repository,
      }),
    ).resolves.toEqual({
      fileId: 'file_test',
      status: 'uploaded',
    });
    expect(repository.getById).toHaveBeenCalledWith('file_test');
    expect(repository.markUploaded).toHaveBeenCalledWith('file_test');
  });

  it('throws not found when completing a missing upload intent', async () => {
    const repository = createFakeRepository({
      getById: vi.fn<FileRepository['getById']>().mockResolvedValue(null),
    });

    await expectFileNotFound(
      completeUploadIntent({
        actor,
        fileId: 'file_missing',
        repository,
      }),
    );
    expect(repository.markUploaded).not.toHaveBeenCalled();
  });

  it('throws not found when completing another workspace upload intent', async () => {
    const repository = createFakeRepository({
      getById: vi
        .fn<FileRepository['getById']>()
        .mockResolvedValue(fakeFileRecord({ workspaceId: actor.workspaceId + 1 })),
    });

    await expectFileNotFound(
      completeUploadIntent({
        actor,
        fileId: 'file_test',
        repository,
      }),
    );
    expect(repository.markUploaded).not.toHaveBeenCalled();
  });

  it('throws not found when upload completion updates no row', async () => {
    const repository = createFakeRepository({
      getById: vi.fn<FileRepository['getById']>().mockResolvedValue(fakeFileRecord()),
      markUploaded: vi.fn<FileRepository['markUploaded']>().mockResolvedValue(null),
    });

    await expectFileNotFound(
      completeUploadIntent({
        actor,
        fileId: 'file_test',
        repository,
      }),
    );
    expect(repository.markUploaded).toHaveBeenCalledWith('file_test');
  });

  it('returns uploaded status when repeat completion returns an uploaded row', async () => {
    const repository = createFakeRepository({
      getById: vi
        .fn<FileRepository['getById']>()
        .mockResolvedValue(fakeFileRecord({ status: 'uploaded' })),
      markUploaded: vi
        .fn<FileRepository['markUploaded']>()
        .mockResolvedValue(fakeFileRecord({ status: 'uploaded' })),
    });

    await expect(
      completeUploadIntent({
        actor,
        fileId: 'file_test',
        repository,
      }),
    ).resolves.toEqual({
      fileId: 'file_test',
      status: 'uploaded',
    });
  });

  it('downloads and persists a generated image from a provider URL', async () => {
    const imageBytes = new Uint8Array([137, 80, 78, 71]);
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(imageBytes, {
        status: 200,
        headers: { 'content-type': 'image/png' },
      }),
    );
    const putObject = vi.fn<StorageAdapter['putObject']>();
    const storage: StorageAdapter = {
      createUploadUrl: vi.fn<StorageAdapter['createUploadUrl']>(),
      createDownloadUrl: vi.fn<StorageAdapter['createDownloadUrl']>(),
      putObject,
      publicUrl: vi.fn<StorageAdapter['publicUrl']>(),
    };
    const createGeneratedFile = vi.fn<FileRepository['createGeneratedFile']>();
    const repository = createFakeRepository({ createGeneratedFile });

    const generated = await createGeneratedImageFromUrl({
      workspaceId: 42,
      sourceUrl: 'https://kie.example.test/result.png',
      filename: 'job result.png',
      mimeType: 'image/png',
      storage,
      repository,
      storageBucket: 'generated-bucket',
      uuidFactory: () => '12345678-1234-1234-1234-123456789abc',
      fetchImpl,
    });

    expect(generated).toEqual({
      fileId: 'file_12345678123412341234123456789abc',
      storageKey:
        'ws/42/generated/file_12345678123412341234123456789abc/job-result.png',
    });
    expect(storage.publicUrl).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledWith('https://kie.example.test/result.png');
    expect(putObject).toHaveBeenCalledWith({
      bucket: 'generated-bucket',
      key: 'ws/42/generated/file_12345678123412341234123456789abc/job-result.png',
      body: imageBytes,
      mimeType: 'image/png',
    });
    expect(createGeneratedFile).toHaveBeenCalledWith({
      id: 'file_12345678123412341234123456789abc',
      workspaceId: 42,
      filename: 'job result.png',
      mimeType: 'image/png',
      sizeBytes: 4,
      storageProvider: 'r2',
      storageBucket: 'generated-bucket',
      storageKey:
        'ws/42/generated/file_12345678123412341234123456789abc/job-result.png',
      visibility: 'private',
      status: 'ready',
      uploadedByType: 'system',
      uploadedById: 'kie-ai',
    });
  });

  it('throws a stable gateway error when generated image download fails', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('not found', { status: 404 }),
    );
    const storage: StorageAdapter = {
      createUploadUrl: vi.fn<StorageAdapter['createUploadUrl']>(),
      createDownloadUrl: vi.fn<StorageAdapter['createDownloadUrl']>(),
      putObject: vi.fn<StorageAdapter['putObject']>(),
      publicUrl: vi.fn<StorageAdapter['publicUrl']>(),
    };
    const repository = createFakeRepository();

    await expect(
      createGeneratedImageFromUrl({
        workspaceId: 42,
        sourceUrl: 'https://kie.example.test/missing.png',
        filename: 'job.png',
        mimeType: 'image/png',
        storage,
        repository,
        storageBucket: 'generated-bucket',
        fetchImpl,
      }),
    ).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      status: 502,
      message: 'Failed to download generated image.',
    });
    expect(storage.putObject).not.toHaveBeenCalled();
    expect(repository.createGeneratedFile).not.toHaveBeenCalled();
  });

  it('rejects non-https generated image URLs', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const storage: StorageAdapter = {
      createUploadUrl: vi.fn<StorageAdapter['createUploadUrl']>(),
      createDownloadUrl: vi.fn<StorageAdapter['createDownloadUrl']>(),
      putObject: vi.fn<StorageAdapter['putObject']>(),
      publicUrl: vi.fn<StorageAdapter['publicUrl']>(),
    };

    await expect(
      createGeneratedImageFromUrl({
        workspaceId: 42,
        sourceUrl: 'http://kie.example.test/result.png',
        filename: 'job.png',
        mimeType: 'image/png',
        storage,
        repository: createFakeRepository(),
        storageBucket: 'generated-bucket',
        fetchImpl,
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_INVALID_BODY',
      status: 400,
      message: 'Generated image URL must use https.',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects generated image downloads with non-image content types', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('not an image', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    );
    const storage: StorageAdapter = {
      createUploadUrl: vi.fn<StorageAdapter['createUploadUrl']>(),
      createDownloadUrl: vi.fn<StorageAdapter['createDownloadUrl']>(),
      putObject: vi.fn<StorageAdapter['putObject']>(),
      publicUrl: vi.fn<StorageAdapter['publicUrl']>(),
    };

    await expect(
      createGeneratedImageFromUrl({
        workspaceId: 42,
        sourceUrl: 'https://kie.example.test/result.png',
        filename: 'job.png',
        mimeType: 'image/png',
        storage,
        repository: createFakeRepository(),
        storageBucket: 'generated-bucket',
        fetchImpl,
      }),
    ).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      status: 502,
      message: 'Generated image download was not an image.',
    });
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it('rejects generated image downloads larger than the content-length limit', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(new Uint8Array([1]), {
        status: 200,
        headers: {
          'content-type': 'image/png',
          'content-length': '5',
        },
      }),
    );
    const storage: StorageAdapter = {
      createUploadUrl: vi.fn<StorageAdapter['createUploadUrl']>(),
      createDownloadUrl: vi.fn<StorageAdapter['createDownloadUrl']>(),
      putObject: vi.fn<StorageAdapter['putObject']>(),
      publicUrl: vi.fn<StorageAdapter['publicUrl']>(),
    };

    await expect(
      createGeneratedImageFromUrl({
        workspaceId: 42,
        sourceUrl: 'https://kie.example.test/result.png',
        filename: 'job.png',
        mimeType: 'image/png',
        storage,
        repository: createFakeRepository(),
        storageBucket: 'generated-bucket',
        fetchImpl,
        maxBytes: 4,
      }),
    ).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      status: 502,
      message: 'Generated image download exceeded the size limit.',
    });
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it('rejects generated image bodies larger than the byte limit', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3, 4, 5]), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      }),
    );
    const storage: StorageAdapter = {
      createUploadUrl: vi.fn<StorageAdapter['createUploadUrl']>(),
      createDownloadUrl: vi.fn<StorageAdapter['createDownloadUrl']>(),
      putObject: vi.fn<StorageAdapter['putObject']>(),
      publicUrl: vi.fn<StorageAdapter['publicUrl']>(),
    };

    await expect(
      createGeneratedImageFromUrl({
        workspaceId: 42,
        sourceUrl: 'https://kie.example.test/result.png',
        filename: 'job.png',
        mimeType: 'image/png',
        storage,
        repository: createFakeRepository(),
        storageBucket: 'generated-bucket',
        fetchImpl,
        maxBytes: 4,
      }),
    ).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      status: 502,
      message: 'Generated image download exceeded the size limit.',
    });
    expect(storage.putObject).not.toHaveBeenCalled();
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
