# ADR 003: Modelagem do DynamoDB, Write Sharding e TTL

## Status
Aceito

## Contexto
O volume diário de telemetria pode atingir dezenas de milhões de eventos (dezenas de GB por dia). Consultas operacionais exigem:
1. Buscar o histórico recente de um sensor específico (`sensorId` + período).
2. Consultar leituras recentes agregadas por zona geográfica e tipo de sensor.
Uma chave ingênua particionada apenas por `zona` criaria uma **partição quente (hot partition)** devido à alta concentração de escrita em poucas zonas urbanas.

## Decisão
Implementamos a tabela `telemetria` com:
- **Chave Primária**: `PK: sensorId` e `SK: ocorridoEm` (ISO 8601).
- **GSI1 (Índice Secundário Global com Write Sharding)**:
  - `PK: zona#tipo#shard` onde `shard` é um sufixo pseudoaleatório distribuído entre 0 e 9 (10 shards virtuais por zona/tipo).
  - `SK: ocorridoEm`.
- **TTL (Time to Live)**: Atributo `expiraEm` configurado para expurgo automático de itens com mais de 7 dias.
- **Histórico Frio**: Firehose descarrega em S3 (formato Parquet colunar) para consultas analíticas de longo prazo via Athena.

## Justificativa
1. **Evita Throttling e Partições Quentes**: A escrita é uniformemente espalhada entre as partições do DynamoDB.
2. **Eficiência de Consulta**: Consultar por sensor é direto (`Query` simples por PK). Para consultar por zona em tempo real, executa-se queries paralelas nos 10 shards e mescla-se o resultado.
3. **FinOps**: TTL remove itens expirados sem custo de escrita, impedindo crescimento descontrolado da conta.

