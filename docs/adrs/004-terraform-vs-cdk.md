# ADR 004: Terraform para Infraestrutura como Código (IaC)

## Status
Aceito

## Contexto
O projeto SmartCity Pulse precisa ser reproduzido e destruído em poucos minutos para garantir a política FinOps de descarte de ambientes. A infraestrutura abrange redes VPC em 3 camadas, Kinesis, DynamoDB, RDS PostgreSQL, S3, IAM com menor privilégio, ECS Fargate e alarmes do CloudWatch.

## Decisão
Adotamos **Terraform** estruturado em módulos reutilizáveis (`infra/modules/*`) e separação de ambientes (`infra/envs/dev` e `infra/envs/prod`).

## Justificativa
1. **Padrão de Mercado Multi-Cloud**: O Terraform HCL é o padrão mais amplamente adotado e requisitado pelo mercado para engenharia de plataforma e nuvem.
2. **Ciclo de Vida Claro**: Comandos determinísticos (`terraform plan`, `terraform apply`, `terraform destroy`) e facilidade de auditar planos em Pull Requests do GitHub Actions.
3. **Módulos Independentes**: Permite destruir recursos caros (como NAT Gateway e instâncias RDS) preservando buckets de estado remoto e tabelas com backups.

