# ADR 010: Retenção de Dados, Privacidade e Conformidade com a LGPD

## Status
Aceito

## Contexto
O monitoramento urbano coleta dados contínuos de sensores e fotos/descrições enviadas por cidadãos ao registrar ocorrências (buracos, semáforos quebrados, etc.). Segundo a LGPD (Lei 13.709/2018), dados pessoais devem ser minimizados, ter finalidade explícita e ciclo de vida limitado. Além disso, câmeras públicas não devem realizar reconhecimento facial em ambiente de estudo.

## Decisão
1. **Minimização**: A ocorrência armazena apenas localização geográfica, descrição e foto do problema urbano. Nenhum dado biométrico ou identificador sensível é exigido do cidadão.
2. **Câmeras e Imagens**: O processamento de imagens (Lambda) extrai exclusivamente rótulos urbanos genéricos (`via_publica`, `pavimento`, `iluminacao`). É expressamente vedado qualquer algoritmo de reconhecimento facial.
3. **Ciclo de Vida & Expiração**:
   - DynamoDB: TTL de 7 dias na telemetria bruta (`expiraEm`).
   - S3 Data Lake: Transição automática para S3 Glacier Flexible Retrieval após 90 dias e expurgo após 365 dias.
   - S3 Ocorrências: Miniaturas geradas e fotos preservadas com políticas de retenção controladas.
   - CloudWatch Logs: Retenção máxima de 7 dias com mascaramento de IPs e tokens.
