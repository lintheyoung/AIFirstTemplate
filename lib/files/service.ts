import type { PlatformActor } from '../auth/actors';
import type { FileVisibilityValue } from '../db/schema';
import { env } from '../env/schema';
import { ApiError } from '../request/errors';
import { fileRepository, type FileRepository } from './repository';
import type { StorageAdapter } from '../storage/adapter';
import { r2StorageAdapter } from '../storage/r2';

export type FileVisibility = FileVisibilityValue;

type UuidFactory = () => string;
const injectedStorageDefaultBucket = 'test-files';
const defaultGeneratedImageMaxBytes = 20 * 1024 * 1024;
const blockedGeneratedImageHosts = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

export function createFileId(uuidFactory: UuidFactory = () => crypto.randomUUID()) {
  return `file_${uuidFactory().replace(/-/g, '')}`;
}

export function sanitizeFilename(filename: string) {
  const sanitized = filename
    .trim()
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return sanitized && sanitized !== '.' && sanitized !== '..' ? sanitized : 'file';
}

export function createStorageKey(args: {
  workspaceId: number;
  fileId: string;
  filename: string;
}) {
  return `ws/${args.workspaceId}/input/${args.fileId}/${sanitizeFilename(args.filename)}`;
}

export function createGeneratedStorageKey(args: {
  workspaceId: number;
  fileId: string;
  filename: string;
}) {
  return `ws/${args.workspaceId}/generated/${args.fileId}/${sanitizeFilename(args.filename)}`;
}

export function normalizeVisibility(value: FileVisibility | undefined): FileVisibility {
  return value === 'public' ? 'public' : 'private';
}

export async function createUploadIntent(args: {
  actor: PlatformActor;
  input: {
    filename: string;
    mimeType: string;
    sizeBytes: number;
    visibility?: FileVisibility;
  };
  repository?: FileRepository;
  storage?: StorageAdapter;
  storageBucket?: string;
  uuidFactory?: UuidFactory;
}) {
  const repository = args.repository ?? fileRepository;
  const storage = args.storage ?? r2StorageAdapter;
  const storageBucket =
    args.storageBucket ?? (args.storage ? injectedStorageDefaultBucket : env.R2_BUCKET_NAME);
  const fileId = createFileId(args.uuidFactory);
  const storageKey = createStorageKey({
    workspaceId: args.actor.workspaceId,
    fileId,
    filename: args.input.filename,
  });
  const visibility = normalizeVisibility(args.input.visibility);
  await repository.createPendingUpload({
    id: fileId,
    workspaceId: args.actor.workspaceId,
    filename: args.input.filename,
    mimeType: args.input.mimeType,
    sizeBytes: args.input.sizeBytes,
    storageProvider: 'r2',
    storageBucket,
    storageKey,
    visibility,
    status: 'pending_upload',
    uploadedByType: args.actor.actorType,
    uploadedById: args.actor.actorId,
  });
  const upload = await storage.createUploadUrl({
    bucket: storageBucket,
    key: storageKey,
    mimeType: args.input.mimeType,
    sizeBytes: args.input.sizeBytes,
  });

  return {
    fileId,
    uploadUrl: upload.url,
    headers: upload.headers,
    visibility,
    storageKey,
    publicUrl: visibility === 'public' ? storage.publicUrl({ key: storageKey }) : null,
  };
}

export async function completeUploadIntent(args: {
  actor: PlatformActor;
  fileId: string;
  repository?: FileRepository;
}) {
  const repository = args.repository ?? fileRepository;
  const file = await repository.getById(args.fileId);

  if (!file || file.workspaceId !== args.actor.workspaceId) {
    throw fileNotFoundError();
  }

  const updatedFile = await repository.markUploaded(args.fileId);

  if (!updatedFile) {
    throw fileNotFoundError();
  }

  return {
    fileId: args.fileId,
    status: updatedFile.status,
  };
}

export async function createGeneratedImageFromUrl(args: {
  workspaceId: number;
  sourceUrl: string;
  filename: string;
  mimeType: string;
  storage?: StorageAdapter;
  repository?: FileRepository;
  storageBucket?: string;
  uuidFactory?: UuidFactory;
  fetchImpl?: typeof fetch;
  maxBytes?: number;
}) {
  const fetchImpl = args.fetchImpl ?? fetch;
  const storage = args.storage ?? r2StorageAdapter;
  const repository = args.repository ?? fileRepository;
  const storageBucket = args.storageBucket ?? env.R2_BUCKET_NAME;
  const maxBytes = args.maxBytes ?? defaultGeneratedImageMaxBytes;
  assertGeneratedImageUrl(args.sourceUrl);
  let response: Response;

  try {
    response = await fetchImpl(args.sourceUrl);
  } catch {
    throw generatedImageDownloadError();
  }

  if (!response.ok) {
    throw generatedImageDownloadError();
  }

  assertGeneratedImageResponse(response, maxBytes);

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await response.arrayBuffer());
  } catch {
    throw generatedImageDownloadError();
  }

  if (bytes.byteLength > maxBytes) {
    throw generatedImageTooLargeError();
  }

  const fileId = createFileId(args.uuidFactory);
  const storageKey = createGeneratedStorageKey({
    workspaceId: args.workspaceId,
    fileId,
    filename: args.filename,
  });

  await storage.putObject({
    bucket: storageBucket,
    key: storageKey,
    body: bytes,
    mimeType: args.mimeType,
  });

  await repository.createGeneratedFile({
    id: fileId,
    workspaceId: args.workspaceId,
    filename: args.filename,
    mimeType: args.mimeType,
    sizeBytes: bytes.byteLength,
    storageProvider: 'r2',
    storageBucket,
    storageKey,
    visibility: 'private',
    status: 'ready',
    uploadedByType: 'system',
    uploadedById: 'kie-ai',
  });

  return {
    fileId,
    storageKey,
  };
}

function fileNotFoundError() {
  return new ApiError({
    code: 'RESOURCE_NOT_FOUND',
    message: 'File was not found.',
    status: 404,
  });
}

function generatedImageDownloadError() {
  return new ApiError({
    code: 'INTERNAL_ERROR',
    message: 'Failed to download generated image.',
    status: 502,
  });
}

function assertGeneratedImageUrl(sourceUrl: string) {
  let url: URL;

  try {
    url = new URL(sourceUrl);
  } catch {
    throw new ApiError({
      code: 'VALIDATION_INVALID_BODY',
      message: 'Generated image URL must use https.',
      status: 400,
    });
  }

  if (url.protocol !== 'https:') {
    throw new ApiError({
      code: 'VALIDATION_INVALID_BODY',
      message: 'Generated image URL must use https.',
      status: 400,
    });
  }

  if (blockedGeneratedImageHosts.has(url.hostname.toLowerCase())) {
    throw new ApiError({
      code: 'VALIDATION_INVALID_BODY',
      message: 'Generated image URL host is not allowed.',
      status: 400,
    });
  }
}

function assertGeneratedImageResponse(response: Response, maxBytes: number) {
  const contentType = response.headers.get('content-type');
  if (!contentType?.toLowerCase().startsWith('image/')) {
    throw new ApiError({
      code: 'INTERNAL_ERROR',
      message: 'Generated image download was not an image.',
      status: 502,
    });
  }

  const contentLength = response.headers.get('content-length');
  if (contentLength) {
    const sizeBytes = Number(contentLength);
    if (!Number.isFinite(sizeBytes) || sizeBytes > maxBytes) {
      throw generatedImageTooLargeError();
    }
  }
}

function generatedImageTooLargeError() {
  return new ApiError({
    code: 'INTERNAL_ERROR',
    message: 'Generated image download exceeded the size limit.',
    status: 502,
  });
}
