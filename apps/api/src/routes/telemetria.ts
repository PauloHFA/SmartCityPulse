import { FastifyInstance } from 'fastify';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamo, DYNAMODB_TELEMETRIA_TABLE } from '../aws';

export async function telemetriaRoutes(fastify: FastifyInstance) {
  fastify.get('/sensores/:id/telemetria', {
    schema: {
      tags: ['Telemetria'],
      summary: 'Consulta leituras recentes de um sensor por período (DynamoDB)',
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      querystring: {
        type: 'object',
        properties: {
          de: { type: 'string', description: 'Data de início ISO 8601' },
          ate: { type: 'string', description: 'Data de fim ISO 8601' },
          limite: { type: 'integer', default: 50 },
        },
      },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { de, ate, limite = 50 } = req.query as { de?: string; ate?: string; limite?: number };

    try {
      let keyCondition = 'sensorId = :sensorId';
      const expressionValues: Record<string, any> = { ':sensorId': id };

      if (de && ate) {
        keyCondition += ' AND ocorridoEm BETWEEN :de AND :ate';
        expressionValues[':de'] = de;
        expressionValues[':ate'] = ate;
      } else if (de) {
        keyCondition += ' AND ocorridoEm >= :de';
        expressionValues[':de'] = de;
      }

      const response = await dynamo.send(
        new QueryCommand({
          TableName: DYNAMODB_TELEMETRIA_TABLE,
          KeyConditionExpression: keyCondition,
          ExpressionAttributeValues: expressionValues,
          ScanIndexForward: false, // Mais recentes primeiro
          Limit: limite,
        })
      );

      return response.Item || response.Items || [];
    } catch (err) {
      req.log.error(err, 'Erro ao consultar telemetria por sensor no DynamoDB');
      reply.status(500);
      return { error: 'Falha ao consultar telemetria', detalhe: (err as Error).message };
    }
  });

  fastify.get('/zonas/:id/telemetria', {
    schema: {
      tags: ['Telemetria'],
      summary: 'Consulta leituras recentes por zona através do índice GSI1 com Write Sharding',
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      querystring: {
        type: 'object',
        properties: {
          tipo: { type: 'string', enum: ['poluicao', 'transito', 'camera'], default: 'poluicao' },
          limite: { type: 'integer', default: 30 },
        },
      },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { tipo = 'poluicao', limite = 30 } = req.query as { tipo?: string; limite?: number };

    try {
      // Dispara queries em paralelo nos 10 shards virtuais (0 a 9)
      const shardQueries = Array.from({ length: 10 }, (_, shard) => {
        const gsi1pk = `${id}#${tipo}#${shard}`;
        return dynamo.send(
          new QueryCommand({
            TableName: DYNAMODB_TELEMETRIA_TABLE,
            IndexName: 'GSI_ZonaTipo',
            KeyConditionExpression: 'gsi1pk = :pk',
            ExpressionAttributeValues: { ':pk': gsi1pk },
            ScanIndexForward: false,
            Limit: Math.ceil(limite / 5),
          })
        );
      });

      const results = await Promise.all(shardQueries);
      const allItems = results.flatMap((r) => r.Items || []);

      // Ordena por ocorridoEm decrescente
      allItems.sort((a, b) => (b.ocorridoEm > a.ocorridoEm ? 1 : -1));

      return allItems.slice(0, limite);
    } catch (err) {
      req.log.error(err, 'Erro ao consultar telemetria por zona no DynamoDB GSI');
      reply.status(500);
      return { error: 'Falha ao consultar telemetria por zona', detalhe: (err as Error).message };
    }
  });
}
