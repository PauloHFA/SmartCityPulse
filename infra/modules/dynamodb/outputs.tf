output "telemetria_table_name" {
  value = aws_dynamodb_table.telemetria.name
}

output "telemetria_table_arn" {
  value = aws_dynamodb_table.telemetria.arn
}

output "estado_sensor_table_name" {
  value = aws_dynamodb_table.estado_sensor.name
}

output "estado_sensor_table_arn" {
  value = aws_dynamodb_table.estado_sensor.arn
}

output "idempotencia_table_name" {
  value = aws_dynamodb_table.idempotencia.name
}

output "idempotencia_table_arn" {
  value = aws_dynamodb_table.idempotencia.arn
}

