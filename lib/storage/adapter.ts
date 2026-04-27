export type CreateUploadUrlArgs = {
  bucket: string;
  key: string;
  mimeType: string;
  sizeBytes: number;
};

export type CreateDownloadUrlArgs = {
  bucket: string;
  key: string;
  responseContentType?: string;
};

export type PutObjectArgs = {
  bucket: string;
  key: string;
  body: Uint8Array;
  mimeType: string;
};

export type StorageAdapter = {
  createUploadUrl(args: CreateUploadUrlArgs): Promise<{
    url: string;
    headers: Record<string, string>;
  }>;
  createDownloadUrl(args: CreateDownloadUrlArgs): Promise<string>;
  putObject(args: PutObjectArgs): Promise<void>;
  publicUrl(args: { key: string }): string | null;
};
