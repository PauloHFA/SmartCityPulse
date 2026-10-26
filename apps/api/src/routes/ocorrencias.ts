import { FastifyInstance } from 'fastify';
import { pool } from '../db';
import { gerarUploadUrl, gerarDownloadUrl } from '../aws';
import crypto from 'crypto';

export async function ocorrenciasRoutes(fastify: FastifyInstance) {
  fastify.get('/ocorrencias', {
    schema: {
      tags: ['Ocorrências'],
      summary: 'Lista ocorrências registradas pelos cidadãos',
    },
  }, async () => {
    const { rows } = await pool.query('SELECT * FROM ocorrencias ORDER BY criada_em DESC');
    
    // Adiciona URLs temporárias assinadas para fotos e miniaturas
    const items = await Promise.all(
      rows.map(async (item) => {
        let fotoUrl: string | null = null;
        let miniaturaUrl: string | null = null;

        if (item.foto_s3_key) {
          fotoUrl = await gerarDownloadUrl(item.foto_s3_key).catch(() => null);
        }
        if (item.miniatura_s3_key) {
          miniaturaUrl = await gerarDownloadUrl(item.miniatura_s3_key).catch(() => null);
        }

        return {
          ...item,
          fotoUrl,
          miniaturaUrl,
        };
      })
    );

    return items;
  });

  fastify.post('/ocorrencias', {
    schema: {
      tags: ['Ocorrências'],
      summary: 'Registra nova ocorrência e gera URL pré-assinada do S3 para upload da foto',
      body: {
        type: 'object',
        required: ['tipo', 'descricao', 'latitude', 'longitude'],
        properties: {
          usuario_id: { type: 'string' },
          tipo: { type: 'string' },
          descricao: { type: 'string' },
          latitude: { type: 'number' },
          longitude: { type: 'number' },
          incluir_foto: { type: 'boolean', default: true },
        },
      },
    },
  }, async (req, reply) => {
    const body = req.body as any;
    const ocorrenciaId = `oco-${crypto.randomUUID().slice(0, 8)}`;
    const usuarioId = body.usuario_id || 'usr-cidadao-anonimo';

    let s3Key: string | null = null;
    let uploadUrl: string | null = null;

    if (body.incluir_foto) {
      s3Key = `ocorrencias/raw/${ocorrenciaId}.jpg`;
      uploadUrl = await gerarUploadUrl(s3Key, 'image/jpeg');
    }

    const { rows } = await pool.query(
      `INSERT INTO ocorrencias (id, usuario_id, tipo, descricao, latitude, longitude, foto_s3_key, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'aberta')
       RETURNING *`,
      [ocorrenciaId, usuarioId, body.tipo, body.descricao, body.latitude, body.longitude, s3Key]
    );

    reply.status(201);
    return {
      ocorrencia: rows[0],
      uploadUrl,
      s3Key,
      instrucao: uploadUrl
        ? 'Envie a imagem via requisição HTTP PUT direta para a uploadUrl informada com Content-Type: image/jpeg'
        : 'Ocorrência registrada sem foto',
    };
  });
}
