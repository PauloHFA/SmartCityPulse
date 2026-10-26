variable "project_name" {
  type    = string
  default = "smartcity-pulse"
}

variable "environment" {
  type    = string
  default = "dev"
}

variable "sns_alert_topic_arn" {
  type        = string
  description = "Tópico SNS que receberá notificações dos alarmes CloudWatch"
}

variable "kinesis_stream_name" {
  type = string
}

variable "alertas_dlq_name" {
  type = string
}

variable "tags" {
  type    = map(string)
  default = {}
}

