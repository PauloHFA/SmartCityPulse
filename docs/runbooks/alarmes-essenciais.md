# Runbooks Operacionais - Alarmes Essenciais CloudWatch

Este documento descreve os procedimentos de mitigação rápida para cada um dos alarmes essenciais definidos na arquitetura do SmartCity Pulse.

---

## 1. Alarme: `Kinesis-ConsumidorAtrasado`
- **Métrica**: `GetRecords.IteratorAgeMilliseconds`
- **Gatilho**: Valor crescente sustentado por mais de 5 minutos (> 60.000 ms).
- **Causa Raiz Mais Provável**: 
  - O volume de escrita superou a capacidade de processamento do consumidor.
  - Bloqueio ou lentidão nas escritas do DynamoDB (`telemetria` ou `idempotencia`).
  - Falhas repetidas em registros do stream causando retentativas no loop.
- **Procedimento de Investigação & Mitigação**:
  1. Verificar logs do ECS Fargate: `aws logs tail /ecs/smartcity-dev-telemetria-consumer --follow`.
  2. Verificar métrica `ThrottledRequests` no DynamoDB. Se houver throttling, avaliar write sharding.
  3. Se o volume de sensores tiver aumentado, realizar resharding do Kinesis (`aws kinesis update-shard-count`).
  4. Escalar horizontalmente o número de tarefas do ECS até o limite de 1 tarefa por shard.

---

## 2. Alarme: `SQS-DLQComMensagens`
- **Métrica**: `ApproximateNumberOfMessagesVisible` no `smartcity-alertas-dlq` ou `smartcity-ocorrencias-imagem-dlq`.
- **Gatilho**: Valor > 0.
- **Causa Raiz Mais Provável**:
  - Mensagem "venenosa" (poison message) com JSON malformado ou campos violando regras de banco.
  - Indisponibilidade temporária de conexão com o PostgreSQL ou S3.
- **Procedimento de Investigação & Mitigação**:
  1. Inspecionar as mensagens retidas na DLQ sem apagá-las:
     ```bash
     aws sqs receive-message --queue-url <DLQ_URL> --attribute-names All --max-number-of-messages 5
     ```
  2. Identificar se o erro é no esquema ou falha transacional.
  3. Aplicar correção no código se necessário.
  4. Utilizar o **SQS Dead-Letter Queue Redrive** para reprocessar as mensagens de volta à fila principal:
     ```bash
     aws sqs start-message-move-task --source-arn <DLQ_ARN> --destination-arn <QUEUE_ARN>
     ```

---

## 3. Alarme: `ALB-Erros5xx` e `ALB-LatenciaElevada`
- **Métrica**: `HTTPCode_Target_5XX_Count` e `TargetResponseTime` (p95 > 300ms).
- **Causa Raiz Mais Provável**:
  - Esgotamento do pool de conexões do PostgreSQL (`max_connections` atingido).
  - Tarefas ECS sofrendo reinicialização por falha de memória (OOMKilled) ou health check timeout.
- **Procedimento de Investigação & Mitigação**:
  1. Inspecionar `RunningTaskCount` e `HealthyHostCount` no target group.
  2. Verificar conexões ativas no RDS: `SELECT count(*) FROM pg_stat_activity;`.
  3. Escalar o número de réplicas da API no ECS:
     ```bash
     aws ecs update-service --cluster smartcity-dev-cluster --service smartcity-dev-api --desired-count 3
     ```
