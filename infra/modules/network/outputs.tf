output "vpc_id" {
  value       = aws_vpc.main.id
  description = "ID da VPC"
}

output "public_subnet_ids" {
  value       = aws_subnet.public[*].id
  description = "IDs das subnets públicas"
}

output "app_subnet_ids" {
  value       = aws_subnet.app[*].id
  description = "IDs das subnets privadas de aplicação"
}

output "data_subnet_ids" {
  value       = aws_subnet.data[*].id
  description = "IDs das subnets privadas de banco de dados"
}

