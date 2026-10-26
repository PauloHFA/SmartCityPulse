import http from 'k6/http';
import { check, sleep } from 'k6';

// Configuração do Teste de Carga (Fase 8 - Metas dos RNFs: RNF-01 a RNF-03)
export const options = {
  stages: [
    { duration: '30s', target: 50 },   // Aquecimento: sobe para 50 VUs
    { duration: '1m', target: 200 },   // Carga sustentada: 200 VUs
    { duration: '30s', target: 500 },   // Pico de rush: 500 VUs
    { duration: '30s', target: 0 },     // Encerramento
  ],
  thresholds: {
    // RNF-03: p95 abaixo de 300 ms para consultas típicas
    http_req_duration: ['p(95)<300'],
    // Taxa de falhas deve ser inferior a 1%
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3000';

export default function () {
  // 1. Consulta Health / Liveness
  const resHealth = http.get(`${BASE_URL}/health`);
  check(resHealth, {
    'health status is 200': (r) => r.status === 200,
  });

  // 2. Consulta Painel Operacional Situacional (RF-08)
  const resPainel = http.get(`${BASE_URL}/painel/resumo`);
  check(resPainel, {
    'painel status is 200': (r) => r.status === 200,
    'painel has metrics': (r) => JSON.parse(r.body).metricas !== undefined,
  });

  // 3. Consulta Zonas Cadastradas
  const resZonas = http.get(`${BASE_URL}/zonas`);
  check(resZonas, {
    'zonas status is 200': (r) => r.status === 200,
  });

  // 4. Simulação de Registro de Ocorrência com Foto (RF-06)
  if (Math.random() < 0.2) {
    const payload = JSON.stringify({
      usuario_id: `usr-k6-${__VU}`,
      tipo: 'buraco_via',
      descricao: 'Buraco no pavimento na avenida principal detectado durante teste k6',
      latitude: -23.5505 + (Math.random() - 0.5) * 0.05,
      longitude: -46.6333 + (Math.random() - 0.5) * 0.05,
      incluir_foto: true,
    });

    const headers = { 'Content-Type': 'application/json' };
    const resOcorrencia = http.post(`${BASE_URL}/ocorrencias`, payload, { headers });
    check(resOcorrencia, {
      'ocorrencia criada com 201': (r) => r.status === 201,
      'possui uploadUrl S3': (r) => JSON.parse(r.body).uploadUrl !== null,
    });
  }

  sleep(0.5);
}

