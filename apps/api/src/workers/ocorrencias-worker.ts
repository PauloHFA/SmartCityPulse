import { ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { sqsClient, SQS_OCORRENCIAS_QUEUE_URL } from '../aws';
import { pool } from '../db';

let isRunning = false;

export function iniciarWorkerOcorrencias() {
  if (isRunning) return;
  isRunning = true;
  console.log('[Worker Ocorrências] Inicializado consumidor de atualizações de imagens SQS...');

  async function poll() {
    while (isRunning) {
      try {
        const command = new ReceiveMessageCommand({
          QueueUrl: SQS_OCORRENCIAS_QUEUE_URL,
          MaxNumberOfMessages: 5,
          WaitTimeSeconds: 10,
        });

        const response = await sqsClient.send(command);

        if (response.Messages && response.Messages.length > 0) {
          for (const msg of response.Messages) {
            if (!msg.Body) continue;

            const payload = JSON.parse(msg.Body);
            console.log(`[Worker Ocorrências] Mensagem recebida:`, payload);

            if (payload.tipo === 'IMAGEM_PROCESSADA' && payload.ocorrenciaId) {
              await pool.query(
                `UPDATE ocorrencias 
                 SET miniatura_s3_key = $1, rotulos = $2, status = $3, atualizada_em = NOW()
                 WHERE id = $4`,
                [payload.miniaturaS3Key, JSON.stringify(payload.rotulos || []), payload.status || 'em_analise', payload.ocorrenciaId]
              );
              console.log(`[Worker Ocorrências] Ocorrência ${payload.ocorrenciaId} atualizada com miniatura e rótulos.`);
            }

            // Confirma exclusão da mensagem processada
            await sqsClient.send(
              new DeleteMessageCommand({
                QueueUrl: SQS_OCORRENCIAS_QUEUE_URL,
                ReceiptHandle: msg.ReceiptHandle,
              })
            );
          }
        }
      } catch (err) {
        // Log sem quebrar o loop
        console.error('[Worker Ocorrências] Erro ao consumir fila de imagens:', (err as Error).message);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }

  poll();
}

export function pararWorkerOcorrencias() {
  isRunning = false;
}
