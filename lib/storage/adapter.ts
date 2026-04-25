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

export type StorageAdapter = {
  createUploadUrl(args: CreateUploadUrlArgs): Promise<{
    url: string;
    headers: Record<string, string>;
  }>;
  createDownloadUrl(args: CreateDownloadUrlArgs): Promise<string>;
  publicUrl(args: { key: string | null }): string | null;
};
