# Buckets S3 com Block Public Access, Criptografia e Enforce TLS (Seção 5.4 e 6.3)

locals {
  buckets = {
    telemetria_raw = "${var.project_name}-${var.environment}-telemetria-raw"
    ocorrencias_imagens = "${var.project_name}-${var.environment}-ocorrencias-imagens"
    relatorios = "${var.project_name}-${var.environment}-relatorios"
  }
}

resource "aws_s3_bucket" "b" {
  for_each = local.buckets
  bucket   = each.value

  tags = merge(var.tags, {
    Name = each.value
  })
}

# Bloqueio rigoroso de acesso público em todos os buckets
resource "aws_s3_bucket_public_access_block" "pab" {
  for_each = aws_s3_bucket.b

  bucket                  = each.value.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Criptografia padrão em repouso
resource "aws_s3_bucket_server_side_encryption_configuration" "sec" {
  for_each = aws_s3_bucket.b

  bucket = each.value.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Política obrigando tráfego exclusivamente via HTTPS/TLS
resource "aws_s3_bucket_policy" "enforce_tls" {
  for_each = aws_s3_bucket.b

  bucket = each.value.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "EnforceTLSRequestsOnly"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          each.value.arn,
          "${each.value.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      }
    ]
  })
}

