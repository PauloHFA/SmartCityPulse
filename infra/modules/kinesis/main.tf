resource "aws_kinesis_stream" "telemetria" {
  name             = "${var.project_name}-${var.environment}-telemetria"
  shard_count      = var.shard_count
  retention_period = var.retention_period_hours

  shard_level_metrics = [
    "IncomingBytes",
    "IncomingRecords",
    "OutgoingBytes",
    "OutgoingRecords",
    "WriteProvisionedThroughputExceeded",
    "ReadProvisionedThroughputExceeded",
    "IteratorAgeMilliseconds"
  ]

  stream_mode_details {
    stream_mode = "PROVISIONED"
  }

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-telemetria"
  })
}

