output "telemetria_raw_bucket" {
  value = aws_s3_bucket.b["telemetria_raw"].id
}

output "ocorrencias_imagens_bucket" {
  value = aws_s3_bucket.b["ocorrencias_imagens"].id
}

output "relatorios_bucket" {
  value = aws_s3_bucket.b["relatorios"].id
}

output "ocorrencias_imagens_bucket_arn" {
  value = aws_s3_bucket.b["ocorrencias_imagens"].arn
}

