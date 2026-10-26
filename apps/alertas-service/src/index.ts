import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { AlertaEvento } from '@smartcity/shared';

dotenv.config();

const region = process.env.AWS_REGION || 'us-east-1';
const endpoint = process.env.AWS_ENDPOINT_URL || undefined;

const sqs = new SQSClient({
  region,
  endpoint,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
  },
});

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  database: process.env.POSTGRES_DB || 'smartcity',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
});

const SQS_QUEUE_URL = process.env.SQS_ALERTAS_QUEUE_URL || 'http://localhost:4566/000000000000/smartcity-alertas-queue';

async function processarAlerta(alerta: AlertaEvento) {
  console.log(`[Serviço de Alertas] Processando alerta dedupe_key=${alerta.dedupeKey}`);

  // Verifica se já existe um alerta ABERTO ou RECONHECIDO com a mesma dedupe_key
  const alertaExistente = await pool.query(
    `SELECT id, contador_ocorrencias FROM alertas 
     WHERE dedupe_key = $1 AND status IN ('ABERTO', 'RECONHECIDO')`,
    [alerta.dedupeKey]
  );

  if (alertaExistente.rows.length > 0) {
    const idExistente = alertaExistente.rows[0].id;
    console.log(`[Serviço de Alertas] Alerta ${idExistente} já está em andamento. Incrementando contador...`);
    await pool.query(
      `UPDATE alertas 
       SET contador_ocorrencias = contador_ocorrencias + 1, detalhes = $1 
       WHERE id = $2`,
      [JSON.stringify(alerta), idExistente]
    );
    return;
  }

  // Cria novo alerta no PostgreSQL
  await pool.query(
    `INSERT INTO alertas (id, sensor_id, zona_id, severidade, status, aberto_em, dedupe_key, detalhes, contador_ocorrencias)
     VALUES ($1, $2, $3, $4, 'ABERTO', NOW(), $5, $6, 1)`,
    [alerta.id, alerta.sensorId, alerta.zonaId, alerta.severidade, alerta.dedupeKey, JSON.stringify(alerta)]
  );

  console.log(`[Serviço de Alertas] Novo alerta criado no RDS: ${alerta.id}`);

  // Dispara notificações (email / webhook mock)
  const notificacaoId = `notif-${Date.now()}`;
  const canal = alerta.severidade === 'critica' ? 'sms' : 'email';
  const destino = alerta.severidade === 'critica' ? '+551199999999' : 'operador@smartcity.gov.br';
  const msgTexto = `[${alerta.severidade.toUpperCase()}] Anomalia detectada no sensor ${alerta.sensorId} (${alerta.metrica}=${alerta.valorLido}).`;

  await pool.query(
    `INSERT INTO notificacoes (id, alerta_id, canal, destino, status, tentativas, mensagem)
     VALUES ($1, $2, $3, $4, 'enviada', 1, $5)`,
    [notificacaoId, alerta.id, canal, destino, msgTexto]
  );

  console.log(`[Notificação] Mensagem enviada para ${destino} via ${canal}: "${msgTexto}"`);
}

async function loopConsumidor() {
  console.log(`[Serviço de Alertas] Conectando à fila SQS: ${SQS_QUEUE_URL}`);

  while (true) {
    try {
      const resp = await sqs.send(
        new ReceiveMessageCommand({
          QueueUrl: SQS_QUEUE_URL,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 15,
        })
      );

      if (resp.Messages && resp.Messages.length > 0) {
        for (const msg of resp.Messages) {
          if (!msg.Body) continue;

          try {
            const body = JSON.parse(msg.Body);
            // Mensagens vindas via SNS têm o campo 'Message'
            const alertaDados = body.Message ? JSON.parse(body.Message) : body;

            await processarAlerta(alertaDados);

            // Exclui mensagem da fila após sucesso
            await sqs.send(
              new DeleteMessageCommand({
                QueueUrl: SQS_QUEUE_URL,
                ReceiptHandle: msg.ReceiptHandle,
              })
            );
          } catch (itemErr) {
            console.error(`[Serviço de Alertas] Erro ao processar mensagem individual:`, (itemErr as Error).message);
            // Mensagem retornará à fila e eventualmente irá para DLQ após 3 falhas
          }
        }
      }
    } catch (err) {
      console.error(`[Serviço de Alertas] Erro na recepção da fila SQS:`, (err as Error).message);
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
}

loopConsumidor();
