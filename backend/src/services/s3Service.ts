import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import * as fs from 'fs';

const s3Client = new S3Client({
  region: process.env.B2_REGION || 'us-west-004',
  endpoint: `https://${process.env.B2_ENDPOINT}`,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID!,
    secretAccessKey: process.env.B2_APPLICATION_KEY!,
  },
  forcePathStyle: true,
});

export async function uploadToB2(
  filePath: string,
  fileName: string
): Promise<string> {
  try {
    const fileStream = fs.createReadStream(filePath);
    const timestamp = Date.now();
    const key = `recordings/${timestamp}-${fileName}`;

    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: process.env.B2_BUCKET_NAME!,
        Key: key,
        Body: fileStream,
        ContentType: 'video/webm',
      },
    });

    await upload.done();

    return `https://${process.env.B2_ENDPOINT}/${process.env.B2_BUCKET_NAME}/${key}`;
  } catch (error) {
    console.error('Error uploading to B2:', error);
    throw error;
  }
}

export async function uploadBuffer(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  try {
    const timestamp = Date.now();
    const key = `recordings/${timestamp}-${fileName}`;

    const command = new PutObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: 'video/webm',
    });

    await s3Client.send(command);

    return `https://${process.env.B2_ENDPOINT}/${process.env.B2_BUCKET_NAME}/${key}`;
  } catch (error) {
    console.error('Error uploading buffer to B2:', error);
    throw error;
  }
}
