import { eq } from 'drizzle-orm';
import { db } from '../db/drizzle';
import {
  files,
  type ActorTypeValue,
  type FileStatusValue,
  type FileVisibilityValue,
} from '../db/schema';

export type FileRecord = typeof files.$inferSelect;

export type CreateFileRecordInput = {
  id: string;
  workspaceId: number;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storageProvider: string;
  storageBucket: string;
  storageKey: string;
  visibility: FileVisibilityValue;
  status: FileStatusValue;
  metadataJson?: string;
  uploadedByType: ActorTypeValue;
  uploadedById: string;
};

export type FileRepository = {
  createPendingUpload(input: CreateFileRecordInput): Promise<void>;
  markUploaded(fileId: string): Promise<FileRecord | null>;
  getById(fileId: string): Promise<FileRecord | null>;
  createGeneratedFile(input: CreateFileRecordInput): Promise<void>;
};

async function createFileRecord(input: CreateFileRecordInput) {
  await db.insert(files).values({
    ...input,
    metadataJson: input.metadataJson ?? '{}',
  });
}

export const fileRepository: FileRepository = {
  async createPendingUpload(input) {
    await createFileRecord(input);
  },

  async markUploaded(fileId) {
    const [record] = await db
      .update(files)
      .set({ status: 'uploaded', updatedAt: new Date() })
      .where(eq(files.id, fileId))
      .returning();

    return record ?? null;
  },

  async getById(fileId) {
    const [record] = await db.select().from(files).where(eq(files.id, fileId)).limit(1);

    return record ?? null;
  },

  async createGeneratedFile(input) {
    await createFileRecord(input);
  },
};
