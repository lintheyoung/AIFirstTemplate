import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../env/schema';
import type { StorageAdapter } from './adapter';

function createClient() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
}

export const r2StorageAdapter: StorageAdapter = {
  async createUploadUrl(args) {
    const command = new PutObjectCommand({
      Bucket: args.bucket,
      Key: args.key,
      ContentType: args.mimeType,
      ContentLength: args.sizeBytes,
    });

    return {
      url: await getSignedUrl(createClient(), command, { expiresIn: 900 }),
      headers: {
        'content-type': args.mimeType,
      },
    };
  },

  async createDownloadUrl(args) {
    const command = new GetObjectCommand({
      Bucket: args.bucket,
      Key: args.key,
      ResponseContentType: args.responseContentType,
    });

    return getSignedUrl(createClient(), command, { expiresIn: 900 });
  },

  publicUrl(args) {
    if (!args.key) {
      return null;
    }

    const url = new URL(env.R2_PUBLIC_BASE_URL);
    const basePath = url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname;
    const keyPath = args.key
      .replace(/^\/+/, '')
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');

    url.pathname = `${basePath}/${keyPath}`;
    url.search = '';
    url.hash = '';

    return url.toString();
  },
};
