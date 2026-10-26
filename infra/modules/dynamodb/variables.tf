variable "project_name" {
  type        = string
  description = "Nome do projeto"
  default     = "smartcity-pulse"
}

variable "environment" {
  type        = string
  description = "Ambiente (dev, prod)"
  default     = "dev"
}

variable "tags" {
  type        = map(string)
  description = "Etiquetas padrão"
  default     = {}
}

