# ADR 005: OpenTelemetry com AWS Distro for OpenTelemetry (ADOT) vs SDK Legado do X-Ray

## Status
Aceito

## Contexto
Desde 25/02/2026, os SDKs clássicos e o daemon do AWS X-Ray entraram em modo de manutenção estrita (com fim de suporte anunciado para 25/02/2027). A AWS recomenda oficialmente a migração para OpenTelemetry (OTel) com o coletor AWS Distro for OpenTelemetry (ADOT).

## Decisão
Implementamos a instrumentação de telemetria distribuída com a API/SDK padrão do **OpenTelemetry**, com o coletor **ADOT** rodando como sidecar nas tarefas ECS Fargate, enviando traces ao AWS X-Ray.

## Justificativa
1. **Padrão Aberto (CNCF)**: Evita vendor lock-in e utiliza a especificação da indústria suportada por todas as plataformas de observabilidade.
2. **Propagação de Contexto W3C**: Propaga o header canônico `traceparent` através de metadados nas mensagens do Kinesis, SNS e SQS, garantindo rastreabilidade ponta a ponta desde a borda até o processamento da fila.
3. **Fim de Vida do SDK Antigo**: Garante conformidade técnica e durabilidade do código sem risco de obsolescência imediata.

