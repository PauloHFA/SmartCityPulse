import { FastifyInstance } from 'fastify';
import { pool } from '../db';

export async function zonasRoutes(fastify: FastifyInstance) {
  fastify.get('/zonas', {
    schema: {
      tags: ['Zonas'],
      summary: 'Lista todas as zonas monitoradas',
    },
  }, async () => {
    const { rows } = await pool.query('SELECT * FROM zonas ORDER BY nome ASC');
    return rows;
  });

  fastify.post('/zonas', {
    schema: {
      tags: ['Zonas'],
      summary: 'Cadastra uma nova zona de monitoramento',
      body: {
        type: 'object',
        required: ['id', 'nome'],
        properties: {
          id: { type: 'string' },
          nome: { type: 'string' },
          geometria: { type: 'object' },
        },
      },
    },
  }, async (req, reply) => {
    const { id, nome, geometria = {} } = req.body as { id: string; nome: string; geometria?: object };
    const { rows } = await pool.query(
      'INSERT INTO zonas (id, nome, geometria) VALUES ($1, $2, $3) RETURNING *',
      [id, nome, JSON.stringify(geometria)]
    );
    reply.status(201);
    return rows[0];
  });
}

