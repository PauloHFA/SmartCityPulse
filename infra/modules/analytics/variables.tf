variable "project_name" {
  type    = string
  default = "smartcity-pulse"
}

variable "environment" {
  type    = string
  default = "dev"
}

variable "kinesis_stream_arn" {
  type        = string
  description = "ARN do Kinesis Data Stream de origem"
}

variable "s3_bucket_arn" {
  type        = string
  description = "ARN do bucket S3 de telemetria bruta"
}

variable "tags" {
  type    = map(string)
  default = {}
}
