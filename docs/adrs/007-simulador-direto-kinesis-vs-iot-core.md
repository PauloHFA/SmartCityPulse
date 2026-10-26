# ADR 007: Ingestão Direta no Kinesis pelo Simulador vs AWS IoT Core

## Status
Aceito

## Contexto
Dispositivos IoT em campo frequentemente utilizam protocolos leves como MQTT com TLS mútuo (mTLS) e conectividade gerenciada via AWS IoT Core (device shadows, regras de roteamento). No entanto, para um MVP didático com simulador em nuvem/local, o IoT Core adiciona complexidade de certificados X.509 por dispositivo e custo por milhão de mensagens MQTT.

## Decisão
O simulador de telemetria pública diretamente no **Amazon Kinesis Data Streams** usando a API de alto desempenho `PutRecords` em lotes de até 500 registros, mantendo o AWS IoT Core mapeado como extensão futura (Seção 19).

## Justificativa
1. **Simplicidade e Performance**: Permite simular 500 eventos/segundo em poucas chamadas de API sem gerenciar provisionamento de certificados para 5.000 sensores virtuais.
2. **Particionamento Garantido**: O particionamento determinístico por `sensorId` é feito na chamada de ingestão.
