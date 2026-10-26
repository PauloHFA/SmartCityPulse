# VPC em 3 camadas (Pública, Aplicação Privada, Dados Privada) - Seção 6.1

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-vpc"
  })
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main.id

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-igw"
  })
}

# 1. Subnets Públicas (ALB e NAT Gateway)
resource "aws_subnet" "public" {
  count                   = length(var.public_subnets_cidr)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnets_cidr[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-public-${var.availability_zones[count.index]}"
    Tier = "Public"
  })
}

# 2. Subnets Privadas de Aplicação (ECS Fargate)
resource "aws_subnet" "app" {
  count             = length(var.app_subnets_cidr)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.app_subnets_cidr[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-app-${var.availability_zones[count.index]}"
    Tier = "App"
  })
}

# 3. Subnets Privadas de Dados (RDS PostgreSQL isolado sem rota externa)
resource "aws_subnet" "data" {
  count             = length(var.data_subnets_cidr)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.data_subnets_cidr[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-data-${var.availability_zones[count.index]}"
    Tier = "Data"
  })
}

# Elastic IP para NAT Gateway (1 único em dev para economia FinOps)
resource "aws_eip" "nat" {
  count  = var.enable_single_nat_gateway ? 1 : length(var.public_subnets_cidr)
  domain = "vpc"

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-nat-eip"
  })
}

resource "aws_nat_gateway" "nat" {
  count         = var.enable_single_nat_gateway ? 1 : length(var.public_subnets_cidr)
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-nat"
  })

  depends_on = [aws_internet_gateway.igw]
}

# Rotas Públicas
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-public-rt"
  })
}

resource "aws_route_table_association" "public" {
  count          = length(var.public_subnets_cidr)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# Rotas de Aplicação (Saída via NAT Gateway)
resource "aws_route_table" "app" {
  count  = length(var.app_subnets_cidr)
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = var.enable_single_nat_gateway ? aws_nat_gateway.nat[0].id : aws_nat_gateway.nat[count.index].id
  }

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-app-rt-${count.index}"
  })
}

resource "aws_route_table_association" "app" {
  count          = length(var.app_subnets_cidr)
  subnet_id      = aws_subnet.app[count.index].id
  route_table_id = aws_route_table.app[count.index].id
}

# Rotas de Dados (Totalmente isoladas sem acesso à internet)
resource "aws_route_table" "data" {
  vpc_id = aws_vpc.main.id

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-data-rt"
  })
}

resource "aws_route_table_association" "data" {
  count          = length(var.data_subnets_cidr)
  subnet_id      = aws_subnet.data[count.index].id
  route_table_id = aws_route_table.data.id
}

# Gateway Endpoints Gratuitos para S3 e DynamoDB (Evita tráfego pago pelo NAT)
resource "aws_vpc_endpoint" "s3" {
  vpc_id       = aws_vpc.main.id
  service_name = "com.amazonaws.${data.aws_region.current.name}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids = concat([aws_route_table.public.id], aws_route_table.app[*].id)

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-s3-endpoint"
  })
}

resource "aws_vpc_endpoint" "dynamodb" {
  vpc_id       = aws_vpc.main.id
  service_name = "com.amazonaws.${data.aws_region.current.name}.dynamodb"
  vpc_endpoint_type = "Gateway"
  route_table_ids = concat([aws_route_table.public.id], aws_route_table.app[*].id)

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-dynamodb-endpoint"
  })
}

data "aws_region" "current" {}

