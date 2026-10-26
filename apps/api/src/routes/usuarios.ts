import { FastifyInstance } from 'fastify';
import { pool } from '../db';

export async function usuariosRoutes(fastify: FastifyInstance) {
  fastify.get('/usuarios', {
    schema: {
      tags: ['Usuários'],
      summary: 'Lista usuários cadastrados no sistema',
    },
  }, async () => {
    const { rows } = await pool.query('SELECT id, cognito_sub, nome, email, perfil, criado_em FROM usuarios ORDER BY criado_em DESC');
    return rows;
  });

  fastify.post('/usuarios', {
    schema: {
      tags: ['Usuários'],
      summary: 'Cadastra ou provisiona um novo usuário (vinculado ao Cognito)',
      body: {
        type: 'object',
        required: ['id', 'cognito_sub', 'nome', 'email', 'perfil'],
        properties: {
          id: { type: 'string' },
          cognito_sub: { type: 'string' },
          nome: { type: 'string' },
          email: { type: 'string' },
          perfil: { type: 'string', enum: ['cidadao', 'operador', 'gestor', 'admin'] },
        },
      },
    },
  }, async (req, reply) => {
    const b = req.body as any;
    const { rows } = await pool.query(
      `INSERT INTO usuarios (id, cognito_sub, nome, email, perfil)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, perfil = EXCLUDED.perfil
       RETURNING *`,
      [b.id, b.cognito_sub, b.nome, b.email, b.perfil]
    );
    reply.status(201);
    return rows[0];
  });
}

