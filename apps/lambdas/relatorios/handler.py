"""
SmartCity Pulse - Lambda de Relatórios Analíticos
Acionada periodicamente pelo EventBridge Scheduler (ex: diário às 00:00).
Executa consultas analíticas, gera relatório no S3 e notifica via SNS com URL pré-assinada.
"""

import csv
import io
import json
import logging
import os
import time
from datetime import datetime, timezone
import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

AWS_ENDPOINT_URL = os.getenv("AWS_ENDPOINT_URL")
S3_BUCKET_RELATORIOS = os.getenv("S3_BUCKET_RELATORIOS", "smartcity-relatorios")
SNS_TOPIC_ARN = os.getenv("SNS_ALERTAS_TOPIC_ARN")

s3_kwargs = {}
sns_kwargs = {}
if AWS_ENDPOINT_URL:
    s3_kwargs["endpoint_url"] = AWS_ENDPOINT_URL
    sns_kwargs["endpoint_url"] = AWS_ENDPOINT_URL

s3_client = boto3.client("s3", **s3_kwargs)
sns_client = boto3.client("sns", **sns_kwargs)


def handler(event, context):
    logger.info(f"Iniciando geração de relatório analítico agendado: {json.dumps(event)}")

    agora = datetime.now(timezone.utc)
    ano = agora.strftime("%Y")
    mes = agora.strftime("%m")
    dia = agora.strftime("%d")

    # Exemplo de compilação de métricas consolidadas (na AWS real, executa via Athena / Glue)
    dados_relatorio = [
        ["zona", "total_sensores", "media_pm25", "total_alertas_emitidos", "status_geral"],
        ["zona-centro", "25", "34.5", "12", "ATENCAO"],
        ["zona-sul", "20", "22.1", "3", "NORMAL"],
        ["zona-norte", "15", "18.4", "1", "NORMAL"]
    ]

    csv_buffer = io.StringIO()
    writer = csv.writer(csv_buffer)
    writer.writerows(dados_relatorio)
    csv_bytes = csv_buffer.getvalue().encode("utf-8")

    s3_key = f"relatorios/ano={ano}/mes={mes}/dia={dia}/relatorio_consolidado_{int(time.time())}.csv"

    logger.info(f"Salvando relatório em s3://{S3_BUCKET_RELATORIOS}/{s3_key}")
    s3_client.put_object(
        Bucket=S3_BUCKET_RELATORIOS,
        Key=s3_key,
        Body=csv_bytes,
        ContentType="text/csv"
    )

    # Gera link pré-assinado com validade de 24 horas (86400 segundos)
    url_preassinada = s3_client.generate_presigned_url(
        "get_object",
        Params={"Bucket": S3_BUCKET_RELATORIOS, "Key": s3_key},
        ExpiresIn=86400
    )

    mensagem_notificacao = {
        "tipo": "RELATORIO_DIARIO_GERADO",
        "data": agora.strftime("%Y-%m-%d"),
        "s3Key": s3_key,
        "downloadUrl": url_preassinada,
        "resumo": "Relatório analítico diário consolidado disponível para download (válido por 24h)."
    }

    if SNS_TOPIC_ARN:
        logger.info(f"Publicando notificação no SNS: {SNS_TOPIC_ARN}")
        sns_client.publish(
            TopicArn=SNS_TOPIC_ARN,
            Subject=f"SmartCity Pulse - Relatório Diário ({agora.strftime('%d/%m/%Y')})",
            Message=json.dumps(mensagem_notificacao, ensure_ascii=False)
        )

    return {
        "statusCode": 200,
        "body": json.dumps({"mensagem": "Relatório gerado com sucesso", "s3Key": s3_key})
    }

