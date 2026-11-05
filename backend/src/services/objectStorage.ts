import * as fs from 'fs';
import { DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config';

/*
 * DreamObjects (S3-compatible) archive storage. The bucket stays private:
 * the browser only ever receives short-lived presigned URLs, minted for
 * signed-in Archives users.
 */

const PRESIGN_SECONDS = 6 * 3600;
let client: S3Client | null = null;

export function storageConfigured(): boolean {
  const { endpoint, bucket, accessKeyId, secretAccessKey } = config.s3;
  return Boolean(endpoint && bucket && accessKeyId && secretAccessKey);
}

function s3(): S3Client {
  if (!client) {
    client = new S3Client({
      region: config.s3.region,
      endpoint: config.s3.endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId: config.s3.accessKeyId, secretAccessKey: config.s3.secretAccessKey },
    });
  }
  return client;
}

export async function checkBucket(): Promise<string | null> {
  try {
    await s3().send(new HeadBucketCommand({ Bucket: config.s3.bucket }));
    return null;
  } catch (error) {
    const e = error as { name?: string; message?: string };
    return e.name === 'NotFound' || e.name === 'NoSuchBucket'
      ? `Bucket "${config.s3.bucket}" was not found with these keys.`
      : `${e.name ?? 'Error'}: ${e.message ?? 'storage check failed'}`;
  }
}

export async function uploadFile(
  filePath: string,
  key: string,
  contentType: string,
  onProgress?: (fraction: number) => void
): Promise<void> {
  const total = fs.statSync(filePath).size;
  const upload = new Upload({
    client: s3(),
    // No ACL is set, so objects inherit the bucket's private default.
    params: { Bucket: config.s3.bucket, Key: key, Body: fs.createReadStream(filePath), ContentType: contentType },
    partSize: 16 * 1024 * 1024,
    queueSize: 3,
    leavePartsOnError: false,
  });
  upload.on('httpUploadProgress', progress => {
    if (progress.loaded && total) onProgress?.(Math.min(progress.loaded / total, 1));
  });
  await upload.done();
}

export async function deleteObject(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: config.s3.bucket, Key: key }));
}

/** Presigned GET; with `downloadName` the browser saves instead of playing. */
export function presignedUrl(key: string, downloadName?: string): Promise<string> {
  const disposition = downloadName
    ? `attachment; filename="${downloadName.replace(/[^\w.() -]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`
    : undefined;
  return getSignedUrl(
    s3(),
    new GetObjectCommand({
      Bucket: config.s3.bucket,
      Key: key,
      ResponseContentDisposition: disposition,
      ResponseCacheControl: 'private, no-store',
    }),
    { expiresIn: PRESIGN_SECONDS }
  );
}
