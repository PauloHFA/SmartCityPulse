import fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import dotenv from 'dotenv';
import { healthRoutes } from './routes/health';
import { zonasRoutes } from './routes/zonas';
import { sensoresRoutes } from './routes/sensores';
import { alertasRoutes } from './routes/alertas';
import { ocorrenciasRoutes } from './routes/ocorrencias';
import { iniciarWorkerOcorrencias, pararWorkerOcorrencias } from './workers/ocorrencias-worker';
import { pool } from './db';

dotenv.config();

const server = fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    serializers: {
      req(req) {
        return {
          method: req.method,
          url: req.url,
          remoteAddress: req.ip,
          correlationId: req.headers['x-correlation-id'] || 'n/a',
        };
      },
    },
  },
});

async function main() {
  await server.register(cors, {
    origin: '*',
  });

  // Documentação OpenAPI / Swagger
  await server.register(swagger, {
    openapi: {
      info: {
        title: 'SmartCity Pulse API',
        description: 'API Pública da plataforma de monitoramento urbano e IoT em tempo real',
        version: '1.0.0',
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Ambiente Local',
        },
      ],
    },
  });

  await server.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });

  // Registro de Rotas
  await server.register(healthRoutes);
  await server.register(zonasRoutes);
  await server.register(sensoresRoutes);
  await server.register(alertasRoutes);
  await server.register(ocorrenciasRoutes);

  // Inicia worker em segundo plano para consumir atualizações de imagem da Lambda
  iniciarWorkerOcorrencias();

  const PORT = parseInt(process.env.PORT || '3000', 10);
  const HOST = process.env.HOST || '0.0.0.0';

  try {
    await server.listen({ port: PORT, host: HOST });
    console.log(`[API] Servidor rodando em http://${HOST}:${PORT}`);
    console.log(`[API] Swagger UI disponível em http://${HOST}:${PORT}/docs`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }

  // Graceful Shutdown
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      console.log(`[API] Sinal ${signal} recebido. Encerrando graciosamente...`);
      pararWorkerOcorrencias();
      await server.close();
      await pool.end();
      console.log('[API] Encerramento concluído.');
      process.exit(0);
    });
  }
}

main();
