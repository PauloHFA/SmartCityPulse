import { FastifyInstance } from 'fastify';
import { pool } from '../db';

export async function painelRoutes(fastify: FastifyInstance) {
  fastify.get('/painel/resumo', {
    schema: {
      tags: ['Painel Operacional'],
      summary: 'Retorna a visão executiva e situacional por zona, mapa e alertas ativos (RF-08)',
    },
  }, async () => {
    // 1. Zonas e contagem de sensores
    const { rows: zonas } = await pool.query(`
      SELECT 
        z.id, 
        z.nome, 
        z.geometria,
        COUNT(s.id) FILTER (WHERE s.status = 'ativo') as sensores_ativos,
        COUNT(s.id) FILTER (WHERE s.status != 'ativo') as sensores_inativos
      FROM zonas z
      LEFT JOIN sensores s ON z.id = s.zona_id
      GROUP BY z.id, z.nome, z.geometria
      ORDER BY z.nome ASC
    `);

    // 2. Alertas ativos agrupados por severidade e zona
    const { rows: alertasAtivos } = await pool.query(`
      SELECT 
        a.id, 
        a.sensor_id, 
        a.zona_id, 
        a.severidade, 
        a.status, 
        a.aberto_em, 
        a.contador_ocorrencias,
        a.detalhes
      FROM alertas a
      WHERE a.status IN ('ABERTO', 'RECONHECIDO')
      ORDER BY a.aberto_em DESC
    `);

    // 3. Totais consolidados
    const { rows: metricas } = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM sensores) as total_sensores,
        (SELECT COUNT(*) FROM alertas WHERE status IN ('ABERTO', 'RECONHECIDO')) as total_alertas_ativos,
        (SELECT COUNT(*) FROM ocorrencias WHERE status = 'aberta') as total_ocorrencias_abertas,
        (SELECT COUNT(*) FROM notificacoes WHERE status = 'enviada') as total_notificacoes_enviadas
    `);

    return {
      metricas: metricas[0],
      zonas,
      alertasAtivos,
      atualizadoEm: new Date().toISOString(),
    };
  });
}

