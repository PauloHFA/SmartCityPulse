output "alertas_topic_arn" {
  value = aws_sns_topic.alertas.arn
}

output "alertas_queue_url" {
  value = aws_sqs_queue.alertas_queue.id
}

output "alertas_queue_arn" {
  value = aws_sqs_queue.alertas_queue.arn
}

output "alertas_dlq_url" {
  value = aws_sqs_queue.alertas_dlq.id
}

output "ocorrencias_imagem_queue_url" {
  value = aws_sqs_queue.ocorrencias_imagem_queue.id
}

output "ocorrencias_imagem_queue_arn" {
  value = aws_sqs_queue.ocorrencias_imagem_queue.arn
}

