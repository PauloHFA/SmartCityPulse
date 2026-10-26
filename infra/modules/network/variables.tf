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

variable "vpc_cidr" {
  type        = string
  description = "CIDR block da VPC"
  default     = "10.0.0.0/16"
}

variable "public_subnets_cidr" {
  type        = list(string)
  description = "CIDRs das subnets públicas (ALB, NAT)"
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "app_subnets_cidr" {
  type        = list(string)
  description = "CIDRs das subnets privadas de aplicação (ECS Fargate)"
  default     = ["10.0.11.0/24", "10.0.12.0/24"]
}

variable "data_subnets_cidr" {
  type        = list(string)
  description = "CIDRs das subnets privadas de dados (RDS)"
  default     = ["10.0.21.0/24", "10.0.22.0/24"]
}

variable "availability_zones" {
  type        = list(string)
  description = "Zonas de disponibilidade"
  default     = ["us-east-1a", "us-east-1b"]
}

variable "enable_single_nat_gateway" {
  type        = bool
  description = "Habilitar NAT único para economia de custos em dev (FinOps)"
  default     = true
}

variable "tags" {
  type        = map(string)
  description = "Etiquetas padrão do recurso"
  default     = {}
}

