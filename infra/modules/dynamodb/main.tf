# Tabelas DynamoDB conforme Seção 5.2

# 1. Telemetria bruta com write sharding no GSI1 e TTL
resource "aws_dynamodb_table" "telemetria" {
  name         = "${var.project_name}-${var.environment}-telemetria"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "sensorId"
  range_key    = "ocorridoEm"

  attribute {
    name = "sensorId"
    type = "S"
  }

  attribute {
    name = "ocorridoEm"
    type = "S"
  }

  attribute {
    name = "gsi1pk"
    type = "S"
  }

  global_secondary_index {
    name            = "GSI_ZonaTipo"
    hash_key        = "gsi1pk"
    range_key       = "ocorridoEm"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "expiraEm"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = var.environment == "prod"
  }

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-telemetria"
  })
}

# 2. Estado do Sensor e Checkpoint do Detector EWMA
resource "aws_dynamodb_table" "estado_sensor" {
  name         = "${var.project_name}-${var.environment}-estado-sensor"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "sensorId"

  attribute {
    name = "sensorId"
    type = "S"
  }

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-estado-sensor"
  })
}

# 3. Tabela de Idempotência com TTL curto
resource "aws_dynamodb_table" "idempotencia" {
  name         = "${var.project_name}-${var.environment}-idempotencia"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "eventId"

  attribute {
    name = "eventId"
    type = "S"
  }

  ttl {
    attribute_name = "expiraEm"
    enabled        = true
  }

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-idempotencia"
  })
}

