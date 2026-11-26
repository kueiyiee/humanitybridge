import fs from 'node:fs/promises';
import path from 'node:path';
import { DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from '../config/env';

const s3Client = env.mediaStorageProvider === 's3'
  ? new S3Client({
      region: env.s3Region,
      endpoint: env.s3Endpoint || undefined,
      forcePathStyle: Boolean(env.s3Endpoint),
      ...(env.s3AccessKeyId && env.s3SecretAccessKey
        ? { credentials: { accessKeyId: env.s3AccessKeyId, secretAccessKey: env.s3SecretAccessKey } }
        : {}),
    })
  : null;

export async function storePublicMedia(filename: string, contents: Buffer, mimeType: string): Promise<void> {
  if (s3Client) {
    if (!env.s3Bucket) throw new Error('S3_BUCKET is required to store public media.');
    await s3Client.send(new PutObjectCommand({
      Bucket: env.s3Bucket,
      Key: filename,
      Body: contents,
      ContentLength: contents.length,
      ContentType: mimeType,
      CacheControl: 'public, max-age=31536000, immutable',
    }));
    return;
  }

  await fs.writeFile(path.join(env.publicMediaDir, filename), contents, { flag: 'wx', mode: 0o644 });
}

export async function readPublicMedia(filename: string): Promise<Buffer | null> {
  if (s3Client) {
    if (!env.s3Bucket) throw new Error('S3_BUCKET is required to read public media.');
    try {
      const result = await s3Client.send(new GetObjectCommand({ Bucket: env.s3Bucket, Key: filename }));
      if (!result.Body) return null;
      return Buffer.from(await result.Body.transformToByteArray());
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        '$metadata' in error &&
        typeof error.$metadata === 'object' &&
        error.$metadata !== null &&
        'httpStatusCode' in error.$metadata &&
        error.$metadata.httpStatusCode === 404
      ) {
        return null;
      }
      throw error;
    }
  }

  try {
    return await fs.readFile(path.join(env.publicMediaDir, filename));
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function deletePublicMedia(filename: string): Promise<void> {
  if (s3Client) {
    if (!env.s3Bucket) throw new Error('S3_BUCKET is required to delete public media.');
    await s3Client.send(new DeleteObjectCommand({ Bucket: env.s3Bucket, Key: filename }));
    return;
  }
  await fs.unlink(path.join(env.publicMediaDir, filename));
}

export async function checkPublicMediaStorage(): Promise<'available' | 'unavailable'> {
  if (!s3Client) return 'unavailable';
  if (!env.s3Bucket) return 'unavailable';
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: env.s3Bucket }));
    return 'available';
  } catch {
    return 'unavailable';
  }
}

function getPrivateDocumentPath(storageKey: string): string {
  if (!/^documents\/[a-f0-9-]+\.pdf$/i.test(storageKey)) {
    throw new Error('Invalid private document storage key.');
  }
  return path.join(env.privateStorageDir, 'documents', path.basename(storageKey));
}

export async function storePrivateDocument(storageKey: string, contents: Buffer): Promise<void> {
  const filePath = getPrivateDocumentPath(storageKey);
  if (s3Client) {
    if (!env.s3Bucket) throw new Error('S3_BUCKET is required to store private documents.');
    await s3Client.send(new PutObjectCommand({
      Bucket: env.s3Bucket,
      Key: storageKey,
      Body: contents,
      ContentLength: contents.length,
      ContentType: 'application/pdf',
      ContentDisposition: 'attachment',
      CacheControl: 'private, no-store',
    }));
    return;
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  await fs.writeFile(filePath, contents, { flag: 'wx', mode: 0o600 });
}

export async function readPrivateDocument(storageKey: string): Promise<Buffer | null> {
  const filePath = getPrivateDocumentPath(storageKey);
  if (s3Client) {
    if (!env.s3Bucket) throw new Error('S3_BUCKET is required to read private documents.');
    try {
      const result = await s3Client.send(new GetObjectCommand({ Bucket: env.s3Bucket, Key: storageKey }));
      if (!result.Body) return null;
      return Buffer.from(await result.Body.transformToByteArray());
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        '$metadata' in error &&
        typeof error.$metadata === 'object' &&
        error.$metadata !== null &&
        'httpStatusCode' in error.$metadata &&
        error.$metadata.httpStatusCode === 404
      ) {
        return null;
      }
      throw error;
    }
  }

  try {
    return await fs.readFile(filePath);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function deletePrivateDocument(storageKey: string): Promise<void> {
  const filePath = getPrivateDocumentPath(storageKey);
  if (s3Client) {
    if (!env.s3Bucket) throw new Error('S3_BUCKET is required to remove private documents.');
    await s3Client.send(new DeleteObjectCommand({ Bucket: env.s3Bucket, Key: storageKey }));
    return;
  }
  await fs.unlink(filePath);
}
