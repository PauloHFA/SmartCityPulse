#!/usr/bin/env bash
set -e

echo "============================================="
echo "Inicializando recursos AWS no LocalStack..."
echo "============================================="

AWS_REGION=${AWS_DEFAULT_REGION:-us-east-1}

# 1. Buckets S3
echo "[S3] Criando buckets..."
awslocal s3 mb s3://smartcity-telemetria-raw
awslocal s3 mb s3://smartcity-ocorrencias-imagens
awslocal s3 mb s3://smartcity-relatorios

# 2. Kinesis Data Streams
echo "[Kinesis] Criando stream smartcity-telemetria..."
awslocal kinesis create-stream \
    --stream-name smartcity-telemetria \
    --shard-count 1

# 3. DynamoDB Tables
echo "[DynamoDB] Criando tabela telemetria..."
awslocal dynamodb create-table \
    --table-name telemetria \
    --attribute-definitions \
        AttributeName=sensorId,AttributeType=S \
        AttributeName=ocorridoEm,AttributeType=S \
        AttributeName=gsi1pk,AttributeType=S \
    --key-schema \
        AttributeName=sensorId,KeyType=HASH \
        AttributeName=ocorridoEm,KeyType=RANGE \
    --global-secondary-indexes \
        "[
            {
                \"IndexName\": \"GSI_ZonaTipo\",
                \"KeySchema\": [
                    {\"AttributeName\":\"gsi1pk\",\"KeyType\":\"HASH\"},
                    {\"AttributeName\":\"ocorridoEm\",\"KeyType\":\"RANGE\"}
                ],
                \"Projection\": {\"ProjectionType\":\"ALL\"}
            }
        ]" \
    --billing-mode PAY_PER_REQUEST

echo "[DynamoDB] Configurando TTL em telemetria (expiraEm)..."
awslocal dynamodb update-time-to-live \
    --table-name telemetria \
    --time-to-live-specification "Enabled=true, AttributeName=expiraEm"

echo "[DynamoDB] Criando tabela estado_sensor..."
awslocal dynamodb create-table \
    --table-name estado_sensor \
    --attribute-definitions \
        AttributeName=sensorId,AttributeType=S \
    --key-schema \
        AttributeName=sensorId,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST

echo "[DynamoDB] Criando tabela idempotencia..."
awslocal dynamodb create-table \
    --table-name idempotencia \
    --attribute-definitions \
        AttributeName=eventId,AttributeType=S \
    --key-schema \
        AttributeName=eventId,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST

echo "[DynamoDB] Configurando TTL em idempotencia (expiraEm)..."
awslocal dynamodb update-time-to-live \
    --table-name idempotencia \
    --time-to-live-specification "Enabled=true, AttributeName=expiraEm"

# 4. SQS Queues & DLQ
echo "[SQS] Criando filas e Dead Letter Queues..."
DLQ_ALERTAS_URL=$(awslocal sqs create-queue --queue-name smartcity-alertas-dlq --output text --query QueueUrl)
DLQ_ALERTAS_ARN=$(awslocal sqs get-queue-attributes --queue-url "$DLQ_ALERTAS_URL" --attribute-names QueueArn --output text --query Attributes.QueueArn)

awslocal sqs create-queue \
    --queue-name smartcity-alertas-queue \
    --attributes "{\"RedrivePolicy\": \"{\\\"deadLetterTargetArn\\\":\\\"$DLQ_ALERTAS_ARN\\\",\\\"maxReceiveCount\\\":\\\"3\\\"}\"}"

DLQ_IMG_URL=$(awslocal sqs create-queue --queue-name smartcity-ocorrencias-imagem-dlq --output text --query QueueUrl)
DLQ_IMG_ARN=$(awslocal sqs get-queue-attributes --queue-url "$DLQ_IMG_URL" --attribute-names QueueArn --output text --query Attributes.QueueArn)

awslocal sqs create-queue \
    --queue-name smartcity-ocorrencias-imagem-queue \
    --attributes "{\"RedrivePolicy\": \"{\\\"deadLetterTargetArn\\\":\\\"$DLQ_IMG_ARN\\\",\\\"maxReceiveCount\\\":\\\"3\\\"}\"}"

QUEUE_ALERTAS_URL=$(awslocal sqs get-queue-url --queue-name smartcity-alertas-queue --output text --query QueueUrl)
QUEUE_ALERTAS_ARN=$(awslocal sqs get-queue-attributes --queue-url "$QUEUE_ALERTAS_URL" --attribute-names QueueArn --output text --query Attributes.QueueArn)

# 5. SNS Topics
echo "[SNS] Criando tópico de alertas..."
TOPIC_ARN=$(awslocal sns create-topic --name smartcity-alertas-topic --output text --query TopicArn)

echo "[SNS -> SQS] Assinando fila SQS ao tópico SNS..."
awslocal sns subscribe \
    --topic-arn "$TOPIC_ARN" \
    --protocol sqs \
    --notification-endpoint "$QUEUE_ALERTAS_ARN"

echo "============================================="
echo "Inicialização LocalStack concluída com sucesso!"
echo "============================================="

