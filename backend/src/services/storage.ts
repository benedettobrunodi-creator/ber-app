import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import path from 'path';
import { env } from '../config/env';

const s3 = new S3Client({
  region: env.s3Region,
  endpoint: env.s3Endpoint,
  credentials: {
    accessKeyId: env.s3AccessKey!,
    secretAccessKey: env.s3SecretKey!,
  },
  forcePathStyle: true,
});

/**
 * Upload a file buffer to Cloudflare R2.
 * Returns the public URL of the uploaded file.
 */
export async function uploadToR2(
  buffer: Buffer,
  originalName: string,
  contentType: string,
): Promise<string> {
  const ext = path.extname(originalName);
  const key = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

  await s3.send(new PutObjectCommand({
    Bucket: env.s3Bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));

  return `${env.s3PublicUrl}/${key}`;
}

/**
 * Delete a file from R2 by its public URL.
 */
export async function deleteFromR2(publicUrl: string): Promise<void> {
  const key = publicUrl.replace(`${env.s3PublicUrl}/`, '');
  if (!key) return;

  await s3.send(new DeleteObjectCommand({
    Bucket: env.s3Bucket,
    Key: key,
  }));
}

/** Returns true if R2 is configured (all required env vars present). */
export function isR2Configured(): boolean {
  return !!(env.s3Endpoint && env.s3Bucket && env.s3AccessKey && env.s3SecretKey && env.s3PublicUrl);
}
