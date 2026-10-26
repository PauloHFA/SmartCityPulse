# ADR 006: NAT Gateway Único e Gateway Endpoints Gratuitos para Otimização de Custos (FinOps)

## Status
Aceito

## Contexto
O NAT Gateway gerenciado pela AWS cobra uma taxa fixa por hora (~$0.045/hora por AZ) mais taxa por GB processado (~$0.045/GB). Em arquiteturas multi-AZ com 2 ou 3 zonas em ambiente de estudo, isso pode gerar custos fixos de dezenas de dólares por mês mesmo sem tráfego de negócio expressivo. Além disso, tráfego pesado direcionado ao S3 e DynamoDB através do NAT incorreria em custos adicionais por GB.

## Decisão
1. Em desenvolvimento (`dev`), provisionar estritamente **1 único NAT Gateway** compartilhado entre as subnets privadas de aplicação.
2. Habilitar **Gateway VPC Endpoints gratuitos** para o **Amazon S3** e para o **Amazon DynamoDB**, garantindo que todo tráfego de dados massivos de telemetria trafegue pela rede interna da AWS sem cobrança por GB e sem onerar o NAT.
3. Não colocar funções Lambda dentro da VPC quando seu único papel for ler/gravar em S3 e postar em SQS.

## Justificativa
- Elimina mais de 70% dos custos surpresa de infraestrutura de rede em ambientes de desenvolvimento e teste.
- Mantém isolamento e segurança sem comprometer a comunicação essencial.
