import { FastifyInstance } from 'fastify';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, S3_BUCKET_RELATORIOS } from '../aws';
import { pool } from '../db';
import crypto from 'crypto';

export async function relatoriosRoutes(fastify: FastifyInstance) {
  fastify.get('/relatorios', {
    schema: {
      tags: ['Relatórios'],
      summary: 'Lista relatórios gerenciais gerados',
    },
  }, async () => {
    const { rows } = await pool.query('SELECT * FROM relatorios ORDER BY gerado_em DESC');
    
    // Adiciona URL assinada de download em cada um
    const comUrls = await Promise.all(
      rows.map(async (r) => {
        let downloadUrl = null;
        try {
          downloadUrl = await getSignedUrl(
            s3Client,
            new GetObjectCommand({ Bucket: S3_BUCKET_RELATORIOS, Key: r.s3_key }),
            { expiresIn: 86400 }
          );
        } catch {}
        return { ...r, downloadUrl };
      })
    );

    return comUrls;
  });

  fastify.post('/relatorios/gerar', {
    schema: {
      tags: ['Relatórios'],
      summary: 'Gera relatório sob demanda (diário ou semanal) e persiste no S3 (RF-09)',
      body: {
        type: 'object',
        properties: {
          tipo: { type: 'string', enum: ['diario', 'semanal', 'mensal'], default: 'diario' },
          periodo: { type: 'string', default: 'ultimas_24h' },
        },
      },
    },
  }, async (req, reply) => {
    const { tipo = 'diario', periodo = 'ultimas_24h' } = req.body as any;
    const relatorioId = `rel-${crypto.randomUUID().slice(0, 8)}`;
    const agora = new Date();
    const ano = agora.getUTCFullYear();
    const mes = String(agora.getUTCMonth() + 1).padStart(2, '0');
    const dia = String(agora.getUTCDate()).padStart(2, '0');

    // Compila dados para o relatório CSV
    const { rows: alertasSumario } = await pool.query(`
      SELECT zona_id, severidade, COUNT(*) as total 
      FROM alertas 
      GROUP BY zona_id, severidade
    `);

    let csvContent = 'zona_id,severidade,total_alertas\n';
    for (const item of alertasSumario) {
      csvContent += `${item.zona_id},${item.severidade},${item.total}\n`;
    }

    const s3Key = `relatorios/ano=${ano}/mes=${mes}/dia=${dia}/${relatorioId}_${tipo}.csv`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET_RELATORIOS,
        Key: s3Key,
        Body: Buffer.from(csvContent, 'utf-8'),
        ContentType: 'text/csv',
      })
    );

    const { rows } = await pool.query(
      `INSERT INTO relatorios (id, tipo, periodo, s3_key, metadados)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [relatorioId, tipo, periodo, s3Key, JSON.stringify({ gerado_por: 'api_sob_demanda', linhas: alertasSumario.length })]
    );

    const downloadUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({ Bucket: S3_BUCKET_RELATORIOS, Key: s3Key }),
      { expiresIn: 86400 }
    );

    reply.status(201);
    return {
      relatorio: rows[0],
      downloadUrl,
    };
  });
}

