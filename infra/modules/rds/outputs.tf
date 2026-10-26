output "db_instance_endpoint" {
  value = aws_db_instance.postgres.endpoint
}

output "db_instance_address" {
  value = aws_db_instance.postgres.address
}

output "db_instance_port" {
  value = aws_db_instance.postgres.port
}

output "db_security_group_id" {
  value = aws_security_group.rds.id
}

output "secrets_manager_arn" {
  value = aws_secretsmanager_secret.db_credentials.arn
}

