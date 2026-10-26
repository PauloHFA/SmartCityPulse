import {
  KinesisClient,
  DescribeStreamCommand,
  GetShardIteratorCommand,
  GetRecordsCommand,
} from '@aws-sdk/client-kinesis';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
} from '@aws-sdk/lib-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import dotenv from 'dotenv';
import {
  TelemetriaEvento,
  TelemetriaEventoSchema,
  DetectorEwma,
  AlertaEvento,
} from '@smartcity/shared';

dotenv.config();

const region = process.env.AWS_REGION || 'us-east-1';
const endpoint = process.env.AWS_ENDPOINT_URL || undefined;

const awsConfig = {
  region,
  endpoint,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
  },
};

const kinesis = new KinesisClient(awsConfig);
const rawDynamo = new DynamoDBClient(awsConfig);
const dynamo = DynamoDBDocumentClient.from(rawDynamo);
const sns = new SNSClient(awsConfig);

const STREAM_NAME = process.env.KINESIS_STREAM_NAME || 'smartcity-telemetria';
const TABELA_TELEMETRIA = process.env.DYNAMODB_TELEMETRIA_TABLE || 'telemetria';
const TABELA_ESTADO = process.env.DYNAMODB_ESTADO_SENSOR_TABLE || 'estado_sensor';
const TABELA_IDEMPOTENCIA = process.env.DYNAMODB_IDEMPOTENCIA_TABLE || 'idempotencia';
const TOPICO_ALERTAS = process.env.SNS_ALERTAS_TOPIC_ARN || 'arn:aws:sns:us-east-1:000000000000:smartcity-alertas-topic';

// Cache em memória dos detectores EWMA por sensorId
const detectoresEmMemoria = new Map<string, DetectorEwma>();

async function obterDetector(sensorId: string): Promise<DetectorEwma> {
  if (detectoresEmMemoria.has(sensorId)) {
    return detectoresEmMemoria.get(sensorId)!;
  }

  const detector = new DetectorEwma(0.1, 3.5, 15);

  // Tenta restaurar checkpoint do DynamoDB
  try {
    const resp = await dynamo.send(
      new GetCommand({
        TableName: TABELA_ESTADO,
        Key: { sensorId },
      })
    );
    if (resp.Item && resp.Item.estadoDetector) {
      detector.carregarEstado(resp.Item.estadoDetector);
    }
  } catch (err) {
    console.warn(`[Consumidor] Aviso ao carregar estado do sensor ${sensorId}:`, (err as Error).message);
  }

  detectoresEmMemoria.set(sensorId, detector);
  return detector;
}

async function processarEvento(evento: TelemetriaEvento) {
  // 1. Verificação de Idempotência (attribute_not_exists)
  const ttlCurto = Math.floor(Date.now() / 1000) + 86400; // 24h
  try {
    await dynamo.send(
      new PutCommand({
        TableName: TABELA_IDEMPOTENCIA,
        Item: {
          eventId: evento.eventId,
          criadoEm: new Date().toISOString(),
          expiraEm: ttlCurto,
        },
        ConditionExpression: 'attribute_not_exists(eventId)',
      })
    );
  } catch (err: any) {
    if (err.name === 'ConditionalCheckFailedException') {
      console.log(`[Consumidor] Evento duplicado ignorado: ${evento.eventId}`);
      return;
    }
    console.error(`[Consumidor] Erro na verificação de idempotência:`, err.message);
  }

  // 2. Gravação no DynamoDB com Write Sharding no GSI1
  const shardVirtual = Math.floor(Math.random() * 10);
  const gsi1pk = `${evento.zona}#${evento.tipo}#${shardVirtual}`;
  const ttl7Dias = Math.floor(Date.now() / 1000) + 7 * 86400;

  await dynamo.send(
    new PutCommand({
      TableName: TABELA_TELEMETRIA,
      Item: {
        sensorId: evento.sensorId,
        ocorridoEm: evento.ocorridoEm,
        gsi1pk,
        tipo: evento.tipo,
        zona: evento.zona,
        medidas: evento.medidas,
        bateria: evento.bateria,
        expiraEm: ttl7Dias,
      },
    })
  );

  // 3. Detecção de Anomalias (EWMA + z-score)
  let metricaAvaliada: string | null = null;
  let valorLido = 0;

  if (evento.tipo === 'poluicao' && evento.medidas.pm25 !== undefined) {
    metricaAvaliada = 'pm25';
    valorLido = evento.medidas.pm25;
  } else if (evento.tipo === 'transito' && evento.medidas.velocidade !== undefined) {
    metricaAvaliada = 'velocidade';
    valorLido = evento.medidas.velocidade;
  }

  if (metricaAvaliada) {
    const detector = await obterDetector(evento.sensorId);
    const { anomalia, z } = detector.avaliar(valorLido);

    // Salva periodicamente o estado do sensor
    await dynamo.send(
      new PutCommand({
        TableName: TABELA_ESTADO,
        Item: {
          sensorId: evento.sensorId,
          ultimaLeitura: evento.ocorridoEm,
          ultimoValor: valorLido,
          estadoDetector: detector.exportarEstado(),
        },
      })
    );

    // Checagem de Limiares Fixos (RF-03)
    let violouLimiar = false;
    let severidadeLimiar: 'baixa' | 'media' | 'alta' | 'critica' = 'alta';

    if (metricaAvaliada === 'pm25') {
      if (valorLido >= 80) {
        violouLimiar = true;
        severidadeLimiar = 'critica';
      } else if (valorLido >= 50) {
        violouLimiar = true;
        severidadeLimiar = 'alta';
      }
    } else if (metricaAvaliada === 'velocidade' && valorLido <= 15) {
      violouLimiar = true;
      severidadeLimiar = 'media';
    }

    if (anomalia || violouLimiar) {
      const severidadeFinal = Math.abs(z) > 5 || severidadeLimiar === 'critica' ? 'critica' : severidadeLimiar;
      const motivo = anomalia && violouLimiar ? 'Estatístico + Limiar Fixo' : anomalia ? 'Desvio Estatístico (EWMA/z-score)' : 'Limiar Fixo Excedido';
      
      console.warn(
        `🚨 [Consumidor] Alerta detectado (${motivo}) no sensor ${evento.sensorId}! Métrica: ${metricaAvaliada}, Valor: ${valorLido}, z: ${z.toFixed(2)}, Sev: ${severidadeFinal}`
      );

      // Constrói alerta e publica no SNS para fan-out
      const janelaMinutos = new Date(evento.ocorridoEm).toISOString().slice(0, 16); // dedupe por minuto
      const dedupeKey = `${evento.sensorId}#${metricaAvaliada}#${janelaMinutos}`;

      const alerta: AlertaEvento = {
        id: `alt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        sensorId: evento.sensorId,
        zonaId: evento.zona,
        tipoSensor: evento.tipo,
        metrica: metricaAvaliada,
        valorLido,
        limiarOuEsperado: violouLimiar ? (metricaAvaliada === 'pm25' ? 50 : 15) : Math.round((valorLido / (z || 1)) * 10) / 10,
        zScore: Math.round(z * 100) / 100,
        severidade: severidadeFinal,
        abertoEm: new Date().toISOString(),
        dedupeKey,
      };

      await sns.send(
        new PublishCommand({
          TopicArn: TOPICO_ALERTAS,
          Subject: `Alerta de Anomalia: ${evento.sensorId}`,
          Message: JSON.stringify(alerta),
          MessageAttributes: {
            tipoSensor: { DataType: 'String', StringValue: evento.tipo },
            severidade: { DataType: 'String', StringValue: alerta.severidade },
          },
        })
      );
      console.log(`[Consumidor] Alerta publicado com sucesso no SNS: ${alerta.id}`);
    }
  }
}

async function loopConsumo() {
  console.log(`[Consumidor] Aguardando stream ${STREAM_NAME}...`);

  let shardId: string | undefined;

  while (!shardId) {
    try {
      const desc = await kinesis.send(new DescribeStreamCommand({ StreamName: STREAM_NAME }));
      if (desc.StreamDescription?.Shards && desc.StreamDescription.Shards.length > 0) {
        shardId = desc.StreamDescription.Shards[0].ShardId;
        console.log(`[Consumidor] Conectado ao shard: ${shardId}`);
      }
    } catch (err) {
      console.log(`[Consumidor] Tentando localizar stream... (${(err as Error).message})`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  const iterResp = await kinesis.send(
    new GetShardIteratorCommand({
      StreamName: STREAM_NAME,
      ShardId: shardId,
      ShardIteratorType: 'LATEST',
    })
  );

  let iterator = iterResp.ShardIterator;

  console.log('[Consumidor] Loop de ingestão iniciado.');

  while (iterator) {
    try {
      const recordsResp = await kinesis.send(
        new GetRecordsCommand({
          ShardIterator: iterator,
          Limit: 100,
        })
      );

      iterator = recordsResp.NextShardIterator;

      if (recordsResp.Records && recordsResp.Records.length > 0) {
        console.log(`[Consumidor] Recebido lote com ${recordsResp.Records.length} registros.`);
        for (const record of recordsResp.Records) {
          if (!record.Data) continue;
          try {
            const raw = Buffer.from(record.Data).toString('utf-8');
            const parsed = JSON.parse(raw);
            const validado = TelemetriaEventoSchema.safeParse(parsed);
            if (validado.success) {
              await processarEvento(validado.data);
            } else {
              console.warn(`[Consumidor] Registro com schema inválido:`, validado.error.format());
            }
          } catch (itemErr) {
            console.error(`[Consumidor] Falha ao parsear registro:`, (itemErr as Error).message);
          }
        }
      }

      await new Promise((r) => setTimeout(r, 1000));
    } catch (loopErr) {
      console.error(`[Consumidor] Erro no loop de leitura do Kinesis:`, (loopErr as Error).message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

loopConsumo();

