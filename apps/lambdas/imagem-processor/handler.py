"""
SmartCity Pulse - Lambda Processador de Imagens de Ocorrências
Acionado por evento S3 ao enviar foto de ocorrência.
Valida a imagem, gera miniatura e publica resultado em fila SQS para atualização no RDS.
NOTA: Não conecta à VPC nem ao RDS diretamente (RNF-06 e FinOps).
"""

import io
import json
import logging
import os
from urllib.parse import unquote_plus
import boto3
from PIL import Image

logger = logging.getLogger()
logger.setLevel(logging.INFO)

AWS_ENDPOINT_URL = os.getenv("AWS_ENDPOINT_URL")
SQS_QUEUE_URL = os.getenv("SQS_OCORRENCIAS_QUEUE_URL")

s3_kwargs = {}
sqs_kwargs = {}
if AWS_ENDPOINT_URL:
    s3_kwargs["endpoint_url"] = AWS_ENDPOINT_URL
    sqs_kwargs["endpoint_url"] = AWS_ENDPOINT_URL

s3_client = boto3.client("s3", **s3_kwargs)
sqs_client = boto3.client("sqs", **sqs_kwargs)

THUMBNAIL_SIZE = (200, 200)


def handler(event, context):
    logger.info(f"Processando evento S3: {json.dumps(event)}")

    for record in event.get("Records", []):
        try:
            bucket = record["s3"]["bucket"]["name"]
            key = unquote_plus(record["s3"]["object"]["key"])

            # Exclui thumbnails para evitar loop infinito
            if "thumbnails/" in key or "miniatura/" in key:
                logger.info(f"Ignorando objeto que já é miniatura: {key}")
                continue

            logger.info(f"Baixando imagem do bucket {bucket}: {key}")
            response = s3_client.get_object(Bucket=bucket, Key=key)
            image_content = response["Body"].read()

            # Processamento de Imagem com Pillow
            with Image.open(io.BytesIO(image_content)) as img:
                # Converte para RGB se necessário (ex: PNG com canal alfa ou CMYK)
                if img.mode not in ("RGB", "L"):
                    img = img.convert("RGB")

                img.thumbnail(THUMBNAIL_SIZE)
                thumb_buffer = io.BytesIO()
                img.save(thumb_buffer, format="JPEG", quality=85)
                thumb_buffer.seek(0)

            # Define chave da miniatura
            base_name = os.path.basename(key)
            thumb_key = f"thumbnails/{base_name}"

            # Upload da miniatura no S3
            s3_client.put_object(
                Bucket=bucket,
                Key=thumb_key,
                Body=thumb_buffer.getvalue(),
                ContentType="image/jpeg"
            )
            logger.info(f"Miniatura salva com sucesso em s3://{bucket}/{thumb_key}")

            # Extração de ID de ocorrência a partir da chave (ex: ocorrencias/oco-1234.jpg)
            ocorrencia_id = os.path.splitext(base_name)[0]

            # Rótulos simulados / genéricos (sem reconhecimento facial conforme LGPD)
            rotulos_detectados = ["via_publica", "pavimento", "urbano"]

            # Publica evento de conclusão na fila SQS para o serviço de ocorrências atualizar o RDS
            mensagem_sqs = {
                "tipo": "IMAGEM_PROCESSADA",
                "ocorrenciaId": ocorrencia_id,
                "fotoS3Key": key,
                "miniaturaS3Key": thumb_key,
                "rotulos": rotulos_detectados,
                "status": "em_analise"
            }

            if SQS_QUEUE_URL:
                sqs_client.send_message(
                    QueueUrl=SQS_QUEUE_URL,
                    MessageBody=json.dumps(mensagem_sqs),
                    MessageAttributes={
                        "ocorrenciaId": {
                            "DataType": "String",
                            "StringValue": ocorrencia_id
                        }
                    }
                )
                logger.info(f"Mensagem enviada para SQS: {mensagem_sqs}")

        except Exception as e:
            logger.error(f"Erro ao processar imagem {record}: {str(e)}", exc_info=True)
            raise e

    return {"statusCode": 200, "body": json.dumps("Processamento concluído com sucesso")}

