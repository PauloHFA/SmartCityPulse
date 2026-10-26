# Módulo de Observabilidade & Alarmes CloudWatch (Fase 6 - Seção 10.1, 10.2 e 10.3)

# 1. CloudWatch Log Groups com retenção de 7 dias para economia (FinOps)
locals {
  services = ["api", "telemetria-consumer", "alertas-service", "simulador"]
}

resource "aws_cloudwatch_log_group" "services_logs" {
  for_each          = toset(locals.services)
  name              = "/ecs/${var.project_name}-${var.environment}-${each.value}"
  retention_in_days = 7

  tags = var.tags
}

# 2. Alarmes Essenciais CloudWatch

# 2.1 Kinesis: Atraso do Consumidor (IteratorAge)
resource "aws_cloudwatch_metric_alarm" "kinesis_iterator_age" {
  alarm_name          = "${var.project_name}-${var.environment}-kinesis-iterator-age"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "GetRecords.IteratorAgeMilliseconds"
  namespace           = "AWS/Kinesis"
  period              = 60
  statistic           = "Maximum"
  threshold           = 60000 # 60 segundos
  alarm_description   = "Consumidor não está acompanhando a vazão de escrita no stream do Kinesis"
  alarm_actions       = [var.sns_alert_topic_arn]

  dimensions = {
    StreamName = var.kinesis_stream_name
  }

  tags = var.tags
}

# 2.2 SQS: Mensagens na Dead Letter Queue (DLQ > 0)
resource "aws_cloudwatch_metric_alarm" "sqs_dlq_messages" {
  alarm_name          = "${var.project_name}-${var.environment}-sqs-dlq-messages"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Maximum"
  threshold           = 0
  alarm_description   = "Mensagens falharam no processamento e foram retidas na DLQ"
  alarm_actions       = [var.sns_alert_topic_arn]

  dimensions = {
    QueueName = var.alertas_dlq_name
  }

  tags = var.tags
}

# 2.3 Kinesis: Escritas Limitadas (Throughput Exceeded)
resource "aws_cloudwatch_metric_alarm" "kinesis_write_exceeded" {
  alarm_name          = "${var.project_name}-${var.environment}-kinesis-write-exceeded"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "WriteProvisionedThroughputExceeded"
  namespace           = "AWS/Kinesis"
  period              = 60
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Capacidade de gravação do shard Kinesis excedida"
  alarm_actions       = [var.sns_alert_topic_arn]

  dimensions = {
    StreamName = var.kinesis_stream_name
  }

  tags = var.tags
}

# 3. Painel CloudWatch Dashboard Operacional
resource "aws_cloudwatch_dashboard" "operational_dashboard" {
  dashboard_name = "${var.project_name}-${var.environment}-operacional"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/Kinesis", "IncomingRecords", "StreamName", var.kinesis_stream_name, { "stat" : "Sum", "period" : 60 }],
            [".", "GetRecords.IteratorAgeMilliseconds", ".", ".", { "stat" : "Maximum", "period" : 60, "yAxis" : "right" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = "us-east-1"
          title   = "Kinesis: Vazão Ingerida vs Atraso do Consumidor (Iterator Age)"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", var.alertas_dlq_name, { "stat" : "Maximum", "period" : 60 }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = "us-east-1"
          title   = "SQS: Mensagens na Dead-Letter Queue (DLQ)"
        }
      }
    ]
  })
}

