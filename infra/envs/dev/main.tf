terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      projeto         = var.project_name
      ambiente        = var.environment
      dono            = var.owner
      centro-de-custo = var.cost_center
      gerenciado-por  = "terraform"
    }
  }
}

locals {
  common_tags = {
    projeto         = var.project_name
    ambiente        = var.environment
    dono            = var.owner
    centro-de-custo = var.cost_center
  }
}

# 1. Módulo de Rede em 3 Camadas
module "network" {
  source                    = "../../modules/network"
  project_name              = var.project_name
  environment               = var.environment
  enable_single_nat_gateway = true
  tags                      = local.common_tags
}

# 2. Módulo de Streaming (Kinesis)
module "kinesis" {
  source       = "../../modules/kinesis"
  project_name = var.project_name
  environment  = var.environment
  shard_count  = 1
  tags         = local.common_tags
}

# 3. Módulo de Banco de Dados NoSQL (DynamoDB com Write Sharding)
module "dynamodb" {
  source       = "../../modules/dynamodb"
  project_name = var.project_name
  environment  = var.environment
  tags         = local.common_tags
}

# 4. Módulo de Armazenamento de Objetos (S3 com Enforce TLS)
module "s3" {
  source       = "../../modules/s3"
  project_name = var.project_name
  environment  = var.environment
  tags         = local.common_tags
}

# 5. Módulo de Mensageria (SNS + SQS + DLQ)
module "sqs_sns" {
  source       = "../../modules/sqs_sns"
  project_name = var.project_name
  environment  = var.environment
  tags         = local.common_tags
}

# 6. Módulo de Banco Transacional (RDS PostgreSQL Graviton)
module "rds" {
  source          = "../../modules/rds"
  project_name    = var.project_name
  environment     = var.environment
  vpc_id          = module.network.vpc_id
  data_subnet_ids = module.network.data_subnet_ids
  tags            = local.common_tags
}

# Regra de Security Group: subnets de aplicação podem acessar porta 5432 do RDS
resource "aws_security_group_rule" "app_to_rds" {
  type              = "ingress"
  from_port         = 5432
  to_port           = 5432
  protocol          = "tcp"
  cidr_blocks       = ["10.0.11.0/24", "10.0.12.0/24"]
  security_group_id = module.rds.db_security_group_id
  description       = "Permite conexao PostgreSQL apenas a partir das subnets privadas de aplicacao"
}

