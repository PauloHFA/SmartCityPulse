# ADR 001: Adoção do AWS ECS com Fargate vs EKS vs EC2

## Status
Aceito

## Contexto
O projeto SmartCity Pulse precisa executar microsserviços em contêineres de forma contínua (API, consumidores de stream e de fila). A infraestrutura deve suportar auto-scaling, balanceamento via ALB, isolamento de rede em VPC privada e ser economicamente viável para estudos e demonstrações, com facilidade de reprodução e destruição via IaC.

## Decisão
Adotamos **AWS ECS com AWS Fargate (Serverless)** em vez de Amazon EKS ou instâncias EC2 gerenciadas diretamente.

## Justificativa
1. **Controle de Custo (FinOps)**: No EKS há custo fixo mensal pelo plano de controle de cada cluster (~$73/mês), mesmo ocioso. No Fargate, paga-se estritamente por segundo de vCPU e memória das tarefas em execução, viabilizando o uso de Fargate Spot com até 70% de desconto no simulador e consumidor em dev.
2. **Simplicidade Operacional**: Elimina o overhead de gerenciar nós EC2, patches de SO, daemonsets do Kubernetes e atualizações de versão de cluster.
3. **Integração Nativa com AWS**: Integração direta com Application Load Balancer (ALB), CloudWatch Logs, IAM Roles for Tasks e AWS Secrets Manager.

## Consequências
- Os contêineres devem ser configurados com graceful shutdown (SIGTERM) e limites precisos de memória/CPU (`cpu: 256`, `memory: 512`).
- As tarefas rodam em subnets privadas com saída controlada para endpoints e NAT Gateway.

