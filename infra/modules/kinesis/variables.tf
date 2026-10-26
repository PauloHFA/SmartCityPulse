variable "project_name" {
  type        = string
  default     = "smartcity-pulse"
}

variable "environment" {
  type        = string
  default     = "dev"
}

variable "shard_count" {
  type        = number
  description = "Quantidade de shards provisionados (1 em dev para contenção de custos)"
  default     = 1
}

variable "retention_period_hours" {
  type        = number
  description = "Período de retenção do stream (24h padrão)"
  default     = 24
}

variable "tags" {
  type        = map(string)
  default     = {}
}

