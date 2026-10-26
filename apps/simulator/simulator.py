#!/usr/bin/env python3
"""
SmartCity Pulse - Simulador de Sensores Urbanos
Gera telemetria sintética com perfis realistas e injeção controlada de anomalias,
publicando em lotes no Amazon Kinesis Data Streams.
"""

import json
import logging
import math
import os
import random
import time
from datetime import datetime, timezone
from typing import Dict, List, Any
import boto3
from botocore.config import Config

logging.basicConfig(
    level=logging.INFO,
    format='{"timestamp":"%(asctime)s","nivel":"%(levelname)s","servico":"simulador","mensagem":"%(message)s"}'
)
logger = logging.getLogger("simulador")

# Configurações do ambiente
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
AWS_ENDPOINT_URL = os.getenv("AWS_ENDPOINT_URL", "http://localhost:4566")
STREAM_NAME = os.getenv("STREAM_NAME", "smartcity-telemetria")
SENSORS_COUNT = int(os.getenv("SENSORS_COUNT", "60"))
INTERVAL_SECONDS = float(os.getenv("INTERVAL_SECONDS", "5.0"))
ANOMALY_CHANCE = float(os.getenv("ANOMALY_CHANCE", "0.05"))
RANDOM_SEED = os.getenv("RANDOM_SEED")

if RANDOM_SEED:
    random.seed(int(RANDOM_SEED))

ZONAS = ["zona-centro", "zona-sul", "zona-norte"]
TIPOS_SENSORES = ["poluicao", "transito", "camera"]


def criar_cliente_kinesis():
    """Cria o cliente do Kinesis compatível com AWS ou LocalStack."""
    boto_config = Config(retries={"max_attempts": 5, "mode": "standard"})
    kwargs = {
        "region_name": AWS_REGION,
        "config": boto_config
    }
    if AWS_ENDPOINT_URL:
        kwargs["endpoint_url"] = AWS_ENDPOINT_URL
        kwargs["aws_access_key_id"] = os.getenv("AWS_ACCESS_KEY_ID", "test")
        kwargs["aws_secret_access_key"] = os.getenv("AWS_SECRET_ACCESS_KEY", "test")
    return boto3.client("kinesis", **kwargs)


class SimuladorSensores:
    def __init__(self, total_sensores: int):
        self.sensores: List[Dict[str, str]] = []
        for i in range(1, total_sensores + 1):
            tipo = TIPOS_SENSORES[(i - 1) % len(TIPOS_SENSORES)]
            zona = ZONAS[(i - 1) % len(ZONAS)]
            sensor_id = f"{tipo[:4]}-{i:04d}"
            self.sensores.append({
                "sensorId": sensor_id,
                "tipo": tipo,
                "zona": zona,
                "bateria": random.randint(80, 100)
            })
        logger.info(f"Inicializados {len(self.sensores)} sensores sintéticos.")

    def _fator_horario(self) -> float:
        """Simula variação diária com picos nos horários de pico (8h e 18h)."""
        agora = datetime.now(timezone.utc)
        hora = agora.hour + agora.minute / 60.0
        # Picos de rush
        rush_manha = math.exp(-0.5 * ((hora - 8.0) / 1.5) ** 2)
        rush_tarde = math.exp(-0.5 * ((hora - 18.0) / 1.5) ** 2)
        base = 0.3 + 0.7 * max(rush_manha, rush_tarde)
        return max(0.1, min(1.0, base))

    def gerar_evento(self, sensor: Dict[str, Any]) -> Dict[str, Any]:
        """Gera um evento no formato canônico da seção 5.1 da arquitetura."""
        tipo = sensor["tipo"]
        sensor_id = sensor["sensorId"]
        zona = sensor["zona"]
        now = datetime.now(timezone.utc)
        timestamp_iso = now.strftime("%Y-%m-%dT%H:%M:%SZ")
        event_id = f"{sensor_id}-{int(time.time() * 1000)}"

        # Degradação lenta de bateria
        sensor["bateria"] = max(5, sensor["bateria"] - random.choice([0, 0, 0, 1]))

        # Verifica injeção de anomalia controlada
        injetar_anomalia = random.random() < ANOMALY_CHANCE
        fator_rush = self._fator_horario()

        medidas: Dict[str, float] = {}

        if tipo == "poluicao":
            # PM2.5 normal: ~18 +- 4, com rush sobe para ~35. Anomalia: 70 a 140
            pm25_base = 18.0 * (1.0 + 0.8 * fator_rush) + random.gauss(0, 3)
            pm25 = (pm25_base + random.uniform(60, 110)) if injetar_anomalia else pm25_base
            pm10 = pm25 * random.uniform(1.4, 1.8)
            no2 = 20.0 * (1.0 + 0.6 * fator_rush) + (random.uniform(30, 60) if injetar_anomalia else 0)
            medidas = {
                "pm25": round(max(1.0, pm25), 1),
                "pm10": round(max(2.0, pm10), 1),
                "no2": round(max(1.0, no2), 1)
            }

        elif tipo == "transito":
            # Velocidade em km/h (cai no rush ou anomalia/acidente). Contagem de veículos sobe.
            if injetar_anomalia:
                velocidade = random.uniform(2.0, 10.0)  # congestionamento severo / acidente
                contagem = random.randint(70, 120)
            else:
                velocidade = 60.0 * (1.0 - 0.5 * fator_rush) + random.gauss(0, 4)
                contagem = int(30 * (1.0 + 1.2 * fator_rush) + random.randint(-5, 5))

            medidas = {
                "velocidade": round(max(0.0, velocidade), 1),
                "contagem": max(0, contagem)
            }

        elif tipo == "camera":
            # Evento com contagem estimada e referência de frame
            veiculos = int(15 * (1.0 + 1.5 * fator_rush) + random.randint(-3, 3))
            pedestres = int(8 * (1.0 + 0.8 * fator_rush) + random.randint(-2, 2))
            medidas = {
                "veiculos_detectados": max(0, veiculos),
                "pedestres_detectados": max(0, pedestres)
            }

        evento = {
            "schemaVersion": 1,
            "eventId": event_id,
            "sensorId": sensor_id,
            "tipo": tipo,
            "zona": zona,
            "ocorridoEm": timestamp_iso,
            "medidas": medidas,
            "bateria": sensor["bateria"]
        }

        if injetar_anomalia:
            logger.warning(f"Injetando anomalia no sensor {sensor_id} ({tipo}): {medidas}")

        return evento


def publicar_lote(kinesis_client, eventos: List[Dict[str, Any]]) -> int:
    """Publica registros no Kinesis respeitando o limite de 500 registros por chamada."""
    publicados = 0
    for i in range(0, len(eventos), 500):
        lote = eventos[i:i + 500]
        records = [
            {
                "Data": json.dumps(e).encode("utf-8"),
                "PartitionKey": e["sensorId"]
            }
            for e in lote
        ]
        try:
            resp = kinesis_client.put_records(
                StreamName=STREAM_NAME,
                Records=records
            )
            falhas = resp.get("FailedRecordCount", 0)
            publicados += len(lote) - falhas
            if falhas > 0:
                logger.error(f"{falhas} registros falharam ao serem publicados no Kinesis")
        except Exception as ex:
            logger.error(f"Erro ao publicar registros no Kinesis: {ex}")
    return publicados


def aguardar_stream(kinesis_client, max_tentativas=15):
    """Aguarda o stream estar ativo antes de iniciar a publicação."""
    for i in range(max_tentativas):
        try:
            desc = kinesis_client.describe_stream(StreamName=STREAM_NAME)
            status = desc["StreamDescription"]["StreamStatus"]
            if status == "ACTIVE":
                logger.info(f"Stream {STREAM_NAME} está ATIVO.")
                return True
        except Exception as e:
            logger.warning(f"Aguardando stream {STREAM_NAME}... ({e})")
        time.sleep(2)
    return False


def main():
    logger.info("Iniciando SmartCity Pulse Simulator...")
    kinesis = criar_cliente_kinesis()

    if not aguardar_stream(kinesis):
        logger.error("Falha ao conectar ao stream do Kinesis. Encerrando.")
        return

    simulador = SimuladorSensores(SENSORS_COUNT)

    while True:
        inicio = time.time()
        eventos = [simulador.gerar_evento(s) for s in simulador.sensores]
        sucesso = publicar_lote(kinesis, eventos)
        logger.info(f"Lote publicado: {sucesso}/{len(eventos)} eventos enviados com sucesso.")

        decorrido = time.time() - inicio
        espera = max(0.1, INTERVAL_SECONDS - decorrido)
        time.sleep(espera)


if __name__ == "__main__":
    main()

