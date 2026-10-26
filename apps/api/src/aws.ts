import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import dotenv from 'dotenv';

dotenv.config();

const endpoint = process.env.AWS_ENDPOINT_URL || undefined;
const region = process.env.AWS_REGION || 'us-east-1';

const awsConfig = {
  region,
  endpoint,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
  },
  forcePathStyle: !!endpoint, // Necessário para LocalStack
};

export const s3Client = new S3Client(awsConfig);
export const sqsClient = new SQSClient(awsConfig);

export const S3_BUCKET_IMAGENS = process.env.S3_BUCKET_IMAGENS || 'smartcity-ocorrencias-imagens';
export const SQS_OCORRENCIAS_QUEUE_URL = process.env.SQS_OCORRENCIAS_QUEUE_URL || 'http://localhost:4566/000000000000/smartcity-ocorrencias-imagem-queue';

export async function gerarUploadUrl(key: string, contentType = 'image/jpeg'): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET_IMAGENS,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

export async function gerarDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET_IMAGENS,
    Key: key,
  });
  return getSignedUrl(s3Client, command, { expiresIn: 7200 });
}
