variable "project_name" {
  type    = string
  default = "smartcity-pulse"
}

variable "environment" {
  type    = string
  default = "dev"
}

variable "vpc_id" {
  type = string
}

variable "data_subnet_ids" {
  type = list(string)
}

variable "allocated_storage" {
  type    = number
  default = 20
}

variable "instance_class" {
  type        = string
  description = "Classe da instância RDS (Graviton t4g.micro econômico para dev)"
  default     = "db.t4g.micro"
}

variable "database_name" {
  type    = string
  default = "smartcity"
}

variable "admin_username" {
  type    = string
  default = "smartcity_admin"
}

variable "tags" {
  type    = map(string)
  default = {}
}

