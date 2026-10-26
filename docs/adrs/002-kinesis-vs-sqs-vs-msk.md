# ADR 002: Ingestão de Streaming com Amazon Kinesis Data Streams vs SQS vs MSK

## Status
Aceito

## Contexto
Milhares de sensores enviam telemetria em alta frequência (milhares de eventos por segundo). A plataforma necessita de ingestão contínua com garantia de ordenação por sensor, possibilidade de múltiplos consumidores (detecção em tempo real e Firehose para data lake S3) e capacidade de reprocessamento (replay).

## Decisão
Adotamos **Amazon Kinesis Data Streams** para o fluxo primário de telemetria dos sensores, reservando o **Amazon SQS** para filas de trabalho desacopladas (alertas e processamento de imagens).

## Justificativa
1. **Ordenação por Sensor**: O particionamento por `sensorId` garante que todas as leituras de um determinado sensor cheguem na mesma partição (shard) em ordem estrita de envio, viabilizando o algoritmo de detecção de anomalias com estado em memória (EWMA).
2. **Múltiplos Consumidores**: Permite que o consumidor ECS e o Kinesis Firehose leiam os mesmos dados simultaneamente sem duplicar o envio pelo produtor.
3. **Custo vs MSK**: O Amazon MSK (Managed Kafka) possui custo fixo elevado para ambientes de estudo (~$150+/mês para 2-3 brokers mínimos). O Kinesis permite alocar 1 shard provisionado em desenvolvimento (~$11/mês) ou modo sob demanda com destruição ao fim da sessão.
4. **SQS não substitui Kinesis aqui**: No SQS clássico a ordem não é garantida e não há suporte nativo a múltiplos grupos de consumidores com retenção temporal (replay). O SQS FIFO é limitado em vazão e não tem fan-out nativo.

## Consequências
- A escala do consumidor é limitada pelo número de shards (uma tarefa ativa por shard).
- Em desenvolvimento, usa-se 1 shard para minimizar custos.

