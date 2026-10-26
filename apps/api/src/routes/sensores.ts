import { FastifyInstance } from 'fastify';
import { pool } from '../db';

export async function sensoresRoutes(fastify: FastifyInstance) {
  fastify.get('/sensores', {
    schema: {
      tags: ['Sensores'],
      summary: 'Lista sensores cadastrados com filtros opcionais',
      querystring: {
        type: 'object',
        properties: {
          tipo: { type: 'string' },
          zona_id: { type: 'string' },
          status: { type: 'string' },
        },
      },
    },
  }, async (req) => {
    const { tipo, zona_id, status } = req.query as { tipo?: string; zona_id?: string; status?: string };
    let query = 'SELECT s.*, z.nome as zona_nome FROM sensores s LEFT JOIN zonas z ON s.zona_id = z.id WHERE 1=1';
    const params: any[] = [];

    if (tipo) {
      params.push(tipo);
      query += ` AND s.tipo = $${params.length}`;
    }
    if (zona_id) {
      params.push(zona_id);
      query += ` AND s.zona_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND s.status = $${params.length}`;
    }

    query += ' ORDER BY s.instalado_em DESC';
    const { rows } = await pool.query(query, params);
    return rows;
  });

  fastify.post('/sensores', {
    schema: {
      tags: ['Sensores'],
      summary: 'Cadastra um novo sensor',
      body: {
        type: 'object',
        required: ['id', 'tipo', 'zona_id'],
        properties: {
          id: { type: 'string' },
          tipo: { type: 'string', enum: ['poluicao', 'transito', 'camera'] },
          zona_id: { type: 'string' },
          status: { type: 'string', enum: ['ativo', 'inativo', 'manutencao'] },
          metadados: { type: 'object' },
        },
      },
    },
  }, async (req, reply) => {
    const { id, tipo, zona_id, status = 'ativo', metadados = {} } = req.body as any;
    const { rows } = await pool.query(
      `INSERT INTO sensores (id, tipo, zona_id, status, metadados)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, tipo, zona_id, status, JSON.stringify(metadados)]
    );
    reply.status(201);
    return rows[0];
  });
}

