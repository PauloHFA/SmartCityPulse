output "glue_database_name" {
  value = aws_glue_catalog_database.smartcity_db.name
}

output "glue_table_name" {
  value = aws_glue_catalog_table.telemetria_parquet.name
}

output "athena_workgroup_name" {
  value = aws_athena_workgroup.analytics.name
}

output "firehose_delivery_stream_name" {
  value = aws_kinesis_firehose_delivery_stream.telemetria.name
}

