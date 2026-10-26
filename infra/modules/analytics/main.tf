# Módulo de Analytics & Data Lake (Fase 5 - Seção 4.1, 4.2 e 5.4)

# 1. IAM Role para o Kinesis Firehose
resource "aws_iam_role" "firehose_role" {
  name = "${var.project_name}-${var.environment}-firehose-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "firehose.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_policy" "firehose_policy" {
  name = "${var.project_name}-${var.environment}-firehose-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "kinesis:DescribeStream",
          "kinesis:GetShardIterator",
          "kinesis:GetRecords",
          "kinesis:ListShards"
        ]
        Resource = var.kinesis_stream_arn
      },
      {
        Effect = "Allow"
        Action = [
          "s3:AbortMultipartUpload",
          "s3:GetBucketLocation",
          "s3:GetObject",
          "s3:ListBucket",
          "s3:ListBucketMultipartUploads",
          "s3:PutObject"
        ]
        Resource = [
          var.s3_bucket_arn,
          "${var.s3_bucket_arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "glue:GetTable",
          "glue:GetTableVersion",
          "glue:GetTableVersions"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "firehose_attach" {
  role       = aws_iam_role.firehose_role.name
  policy_arn = aws_iam_policy.firehose_policy.arn
}

# 2. Catálogo de Dados do AWS Glue
resource "aws_glue_catalog_database" "smartcity_db" {
  name = "${replace(var.project_name, "-", "_")}_${var.environment}_analytics"
}

resource "aws_glue_catalog_table" "telemetria_parquet" {
  name          = "telemetria_parquet"
  database_name = aws_glue_catalog_database.smartcity_db.name
  table_type    = "EXTERNAL_TABLE"

  parameters = {
    "classification"  = "parquet"
    "compressionType" = "snappy"
  }

  partition_keys {
    name = "ano"
    type = "string"
  }
  partition_keys {
    name = "mes"
    type = "string"
  }
  partition_keys {
    name = "dia"
    type = "string"
  }

  storage_descriptor {
    location      = "${var.s3_bucket_arn}/telemetria-raw/"
    input_format  = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat"
    output_format = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat"

    ser_de_info {
      name                  = "parquet-serde"
      serialization_library = "org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe"
      parameters = {
        "serialization.format" = "1"
      }
    }

    columns {
      name = "eventId"
      type = "string"
    }
    columns {
      name = "sensorId"
      type = "string"
    }
    columns {
      name = "tipo"
      type = "string"
    }
    columns {
      name = "zona"
      type = "string"
    }
    columns {
      name = "ocorridoEm"
      type = "string"
    }
    columns {
      name = "medidas"
      type = "map<string,double>"
    }
    columns {
      name = "bateria"
      type = "int"
    }
  }
}

# 3. Kinesis Firehose Delivery Stream para descarregar em S3 particionado por data
resource "aws_kinesis_firehose_delivery_stream" "telemetria" {
  name        = "${var.project_name}-${var.environment}-telemetria-firehose"
  destination = "extended_s3"

  kinesis_source_configuration {
    kinesis_stream_arn = var.kinesis_stream_arn
    role_arn           = aws_iam_role.firehose_role.arn
  }

  extended_s3_configuration {
    role_arn   = aws_iam_role.firehose_role.arn
    bucket_arn = var.s3_bucket_arn

    # Particionamento dinâmico no S3 por ano, mês e dia
    prefix              = "telemetria-raw/ano=!{timestamp:yyyy}/mes=!{timestamp:MM}/dia=!{timestamp:dd}/"
    error_output_prefix = "telemetria-raw-erros/!{firehose:error-output-type}/ano=!{timestamp:yyyy}/"

    buffer_size     = 5   # MB
    buffer_interval = 300 # Segundos (5 min)

    cloudwatch_logging_options {
      enabled = true
      log_group_name  = "/aws/kinesisfirehose/${var.project_name}-${var.environment}-telemetria"
      log_stream_name = "S3Delivery"
    }
  }

  tags = var.tags
}

# 4. Workgroup do Amazon Athena para Consultas Analíticas
resource "aws_athena_workgroup" "analytics" {
  name          = "${var.project_name}-${var.environment}-athena"
  force_destroy = true

  configuration {
    enforce_workgroup_configuration    = true
    publish_cloudwatch_metrics_enabled = true

    result_configuration {
      output_location = "${var.s3_bucket_arn}/athena-query-results/"
      encryption_configuration {
        encryption_option = "SSE_S3"
      }
    }
  }

  tags = var.tags
}

