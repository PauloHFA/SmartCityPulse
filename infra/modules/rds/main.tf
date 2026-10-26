# Subnet Group nas subnets privadas de dados
resource "aws_db_subnet_group" "rds" {
  name       = "${var.project_name}-${var.environment}-db-subnet-group"
  subnet_ids = var.data_subnet_ids

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-db-subnet-group"
  })
}

# Security Group do RDS
resource "aws_security_group" "rds" {
  name        = "${var.project_name}-${var.environment}-rds-sg"
  description = "Controle de acesso estrito ao RDS PostgreSQL"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-rds-sg"
  })
}

# Gerador de senha forte para o RDS
resource "random_password" "db_password" {
  length           = 24
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# Armazenamento da credencial no AWS Secrets Manager (Seção 6.3)
resource "aws_secretsmanager_secret" "db_credentials" {
  name                    = "${var.project_name}-${var.environment}-rds-credentials"
  recovery_window_in_days = 0

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-rds-credentials"
  })
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    engine   = "postgres"
    host     = aws_db_instance.postgres.address
    port     = aws_db_instance.postgres.port
    username = var.admin_username
    password = random_password.db_password.result
    database = var.database_name
  })
}

# Instância RDS PostgreSQL
resource "aws_db_instance" "postgres" {
  identifier             = "${var.project_name}-${var.environment}-rds"
  engine                 = "postgres"
  engine_version         = "16.1"
  instance_class         = var.instance_class
  allocated_storage      = var.allocated_storage
  max_allocated_storage  = 50
  storage_type           = "gp3"
  storage_encrypted      = true

  db_name  = var.database_name
  username = var.admin_username
  password = random_password.db_password.result

  db_subnet_group_name   = aws_db_subnet_group.rds.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  publicly_accessible = false
  skip_final_snapshot = var.environment != "prod"
  multi_az            = var.environment == "prod"
  deletion_protection = var.environment == "prod"

  auto_minor_version_upgrade = true
  backup_retention_period    = var.environment == "prod" ? 7 : 1

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-rds"
  })
}

