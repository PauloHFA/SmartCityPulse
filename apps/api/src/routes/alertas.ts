import { FastifyInstance } from 'fastify';
import { pool } from '../db';

export async function alertasRoutes(fastify: FastifyInstance) {
  fastify.get('/alertas', {
    schema: {
      tags: ['Alertas'],
      summary: 'Lista alertas operacionais com filtros',
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['ABERTO', 'RECONHECIDO', 'RESOLVIDO', 'AUTO_RESOLVIDO'] },
          severidade: { type: 'string', enum: ['baixa', 'media', 'alta', 'critica'] },
          zona_id: { type: 'string' },
          limite: { type: 'integer', default: 50 },
        },
      },
    },
  }, async (req) => {
    const { status, severidade, zona_id, limite = 50 } = req.query as any;
    let query = `
      SELECT a.*, s.tipo as sensor_tipo, z.nome as zona_nome 
      FROM alertas a
      JOIN sensores s ON a.sensor_id = s.id
      JOIN zonas z ON a.zona_id = z.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status) {
      params.push(status);
      query += ` AND a.status = $${params.length}`;
    }
    if (severidade) {
      params.push(severidade);
      query += ` AND a.severidade = $${params.length}`;
    }
    if (zona_id) {
      params.push(zona_id);
      query += ` AND a.zona_id = $${params.length}`;
    }

    params.push(limite);
    query += ` ORDER BY a.aberto_em DESC LIMIT $${params.length}`;

    const { rows } = await pool.query(query, params);
    return rows;
  });

  fastify.patch('/alertas/:id/status', {
    schema: {
      tags: ['Alertas'],
      summary: 'Atualiza o ciclo de vida do alerta (RECONHECIDO ou RESOLVIDO)',
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['RECONHECIDO', 'RESOLVIDO'] },
        },
      },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { status } = req.body as { status: 'RECONHECIDO' | 'RESOLVIDO' };

    const updateField = status === 'RECONHECIDO' ? 'reconhecido_em' : 'resolvido_em';

    const { rows } = await pool.query(
      `UPDATE alertas 
       SET status = $1, ${updateField} = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [status, id]
    );

    if (rows.length === 0) {
      reply.status(404);
      return { error: 'Alerta não encontrado' };
    }

    return rows[0];
  });
}
