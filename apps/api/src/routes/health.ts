import { FastifyInstance } from 'fastify';
import { pool } from '../db';
import { s3Client, S3_BUCKET_IMAGENS } from '../aws';
import { HeadBucketCommand } from '@aws-sdk/client-s3';

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', {
    schema: {
      tags: ['Health'],
      summary: 'Liveness Probe para ALB / ECS',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
          },
        },
      },
    },
  }, async () => {
    return { status: 'healthy', timestamp: new Date().toISOString() };
  });

  fastify.get('/ready', {
    schema: {
      tags: ['Health'],
      summary: 'Readiness Probe com checagem de dependências',
    },
  }, async (req, reply) => {
    try {
      // 1. Testa banco de dados
      await pool.query('SELECT 1');

      // 2. Testa conectividade com S3
      await s3Client.send(new HeadBucketCommand({ Bucket: S3_BUCKET_IMAGENS }));

      return {
        status: 'ready',
        checks: {
          database: 'UP',
          storage_s3: 'UP',
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      reply.status(503);
      return {
        status: 'not_ready',
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      };
    }
  });
}

