import type { PlatformActor } from '../auth/actors';
import type { FileVisibilityValue } from '../db/schema';
import { env } from '../env/schema';
import type { StorageAdapter } from '../storage/adapter';
import { r2StorageAdapter } from '../storage/r2';

export type FileVisibility = FileVisibilityValue;

type UuidFactory = () => string;
const injectedStorageDefaultBucket = 'test-files';

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
  storage?: StorageAdapter;
  storageBucket?: string;
  uuidFactory?: UuidFactory;
}) {
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
