# Tópico SNS para alertas de anomalia (Fan-out)
resource "aws_sns_topic" "alertas" {
  name = "${var.project_name}-${var.environment}-alertas-topic"

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-alertas-topic"
  })
}

# 1. DLQ e Fila SQS para Alertas
resource "aws_sqs_queue" "alertas_dlq" {
  name                      = "${var.project_name}-${var.environment}-alertas-dlq"
  message_retention_seconds = 1209600 # 14 dias

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-alertas-dlq"
  })
}

resource "aws_sqs_queue" "alertas_queue" {
  name                       = "${var.project_name}-${var.environment}-alertas-queue"
  visibility_timeout_seconds = 60
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.alertas_dlq.arn
    maxReceiveCount     = 3
  })

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-alertas-queue"
  })
}

# Assinatura SNS -> SQS Alertas
resource "aws_sns_topic_subscription" "alertas_sqs_target" {
  topic_arn = aws_sns_topic.alertas.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.alertas_queue.arn
}

# Permissão para o SNS postar na fila SQS
resource "aws_sqs_queue_policy" "alertas_sns_publish" {
  queue_url = aws_sqs_queue.alertas_queue.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowSNSPublishToSQS"
        Effect    = "Allow"
        Principal = {
          Service = "sns.amazonaws.com"
        }
        Action   = "sqs:SendMessage"
        Resource = aws_sqs_queue.alertas_queue.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_sns_topic.alertas.arn
          }
        }
      }
    ]
  })
}

# 2. DLQ e Fila SQS para Notificações de Imagens Processadas
resource "aws_sqs_queue" "ocorrencias_imagem_dlq" {
  name                      = "${var.project_name}-${var.environment}-ocorrencias-imagem-dlq"
  message_retention_seconds = 1209600

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-ocorrencias-imagem-dlq"
  })
}

resource "aws_sqs_queue" "ocorrencias_imagem_queue" {
  name                       = "${var.project_name}-${var.environment}-ocorrencias-imagem-queue"
  visibility_timeout_seconds = 60
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.ocorrencias_imagem_dlq.arn
    maxReceiveCount     = 3
  })

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-ocorrencias-imagem-queue"
  })
}

