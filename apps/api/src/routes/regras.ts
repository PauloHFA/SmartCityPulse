import { FastifyInstance } from 'fastify';
import { pool } from '../db';

export async function regrasRoutes(fastify: FastifyInstance) {
  fastify.get('/regras', {
    schema: {
      tags: ['Regras de Alerta'],
      summary: 'Lista regras de alerta configuradas',
    },
  }, async () => {
    const { rows } = await pool.query('SELECT * FROM regras_alerta ORDER BY id ASC');
    return rows;
  });

  fastify.post('/regras', {
    schema: {
      tags: ['Regras de Alerta'],
      summary: 'Cadastra uma nova regra de alerta',
      body: {
        type: 'object',
        required: ['id', 'tipo_sensor', 'metrica', 'operador', 'limiar', 'severidade'],
        properties: {
          id: { type: 'string' },
          tipo_sensor: { type: 'string' },
          metrica: { type: 'string' },
          operador: { type: 'string', enum: ['>', '>=', '<', '<=', '==', '!='] },
          limiar: { type: 'number' },
          janela_s: { type: 'integer', default: 60 },
          severidade: { type: 'string', enum: ['baixa', 'media', 'alta', 'critica'] },
          ativa: { type: 'boolean', default: true },
          descricao: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const b = req.body as any;
    const { rows } = await pool.query(
      `INSERT INTO regras_alerta (id, tipo_sensor, metrica, operador, limiar, janela_s, severidade, ativa, descricao)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [b.id, b.tipo_sensor, b.metrica, b.operador, b.limiar, b.janela_s || 60, b.severidade, b.ativa ?? true, b.descricao || '']
    );
    reply.status(201);
    return rows[0];
  });
}

