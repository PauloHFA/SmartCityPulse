output "vpc_id" {
  value = module.network.vpc_id
}

output "kinesis_stream_name" {
  value = module.kinesis.stream_name
}

output "dynamodb_telemetria_table" {
  value = module.dynamodb.telemetria_table_name
}

output "rds_endpoint" {
  value = module.rds.db_instance_endpoint
}

output "sns_alertas_topic_arn" {
  value = module.sqs_sns.alertas_topic_arn
}

output "sqs_alertas_queue_url" {
  value = module.sqs_sns.alertas_queue_url
}

