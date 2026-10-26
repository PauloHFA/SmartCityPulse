-- SmartCity Pulse - Schema Inicial PostgreSQL (RDS Transacional)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Zonas da cidade
CREATE TABLE IF NOT EXISTS zonas (
    id VARCHAR(50) PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    geometria JSONB NOT NULL DEFAULT '{}'::jsonb,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cadastro de sensores
CREATE TABLE IF NOT EXISTS sensores (
    id VARCHAR(50) PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('poluicao', 'transito', 'camera')),
    zona_id VARCHAR(50) NOT NULL REFERENCES zonas(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'manutencao')),
    instalado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadados JSONB DEFAULT '{}'::jsonb
);

-- Regras de alerta por tipo de sensor
CREATE TABLE IF NOT EXISTS regras_alerta (
    id VARCHAR(50) PRIMARY KEY,
    tipo_sensor VARCHAR(50) NOT NULL,
    metrica VARCHAR(50) NOT NULL,
    operador VARCHAR(10) NOT NULL CHECK (operador IN ('>', '>=', '<', '<=', '==', '!=')),
    limiar DOUBLE PRECISION NOT NULL,
    janela_s INT NOT NULL DEFAULT 60,
    severidade VARCHAR(20) NOT NULL CHECK (severidade IN ('baixa', 'media', 'alta', 'critica')),
    ativa BOOLEAN NOT NULL DEFAULT true,
    descricao VARCHAR(255)
);

-- Alertas emitidos e ciclo de vida
CREATE TABLE IF NOT EXISTS alertas (
    id VARCHAR(50) PRIMARY KEY,
    regra_id VARCHAR(50) REFERENCES regras_alerta(id) ON DELETE SET NULL,
    sensor_id VARCHAR(50) REFERENCES sensores(id) ON DELETE CASCADE,
    zona_id VARCHAR(50) REFERENCES zonas(id) ON DELETE CASCADE,
    severidade VARCHAR(20) NOT NULL CHECK (severidade IN ('baixa', 'media', 'alta', 'critica')),
    status VARCHAR(20) NOT NULL DEFAULT 'ABERTO' CHECK (status IN ('ABERTO', 'RECONHECIDO', 'RESOLVIDO', 'AUTO_RESOLVIDO')),
    aberto_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reconhecido_em TIMESTAMPTZ,
    resolvido_em TIMESTAMPTZ,
    dedupe_key VARCHAR(255) NOT NULL,
    detalhes JSONB NOT NULL DEFAULT '{}'::jsonb,
    contador_ocorrencias INT NOT NULL DEFAULT 1
);

-- Índice único condicional para dedupe_key em alertas abertos/reconhecidos
CREATE UNIQUE INDEX IF NOT EXISTS idx_alertas_dedupe_aberto 
ON alertas (dedupe_key) 
WHERE status IN ('ABERTO', 'RECONHECIDO');

-- Notificações enviadas aos operadores
CREATE TABLE IF NOT EXISTS notificacoes (
    id VARCHAR(50) PRIMARY KEY,
    alerta_id VARCHAR(50) NOT NULL REFERENCES alertas(id) ON DELETE CASCADE,
    canal VARCHAR(20) NOT NULL CHECK (canal IN ('email', 'sms', 'webhook')),
    destino VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'enviada', 'falha')),
    tentativas INT NOT NULL DEFAULT 0,
    mensagem TEXT,
    criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizada_em TIMESTAMPTZ DEFAULT NOW()
);

-- Usuários e perfis do sistema (mapeados com Cognito)
CREATE TABLE IF NOT EXISTS usuarios (
    id VARCHAR(50) PRIMARY KEY,
    cognito_sub VARCHAR(100) UNIQUE NOT NULL,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    perfil VARCHAR(20) NOT NULL CHECK (perfil IN ('cidadao', 'operador', 'gestor', 'admin')),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ocorrências registradas por cidadãos
CREATE TABLE IF NOT EXISTS ocorrencias (
    id VARCHAR(50) PRIMARY KEY,
    usuario_id VARCHAR(50) REFERENCES usuarios(id) ON DELETE SET NULL,
    tipo VARCHAR(50) NOT NULL,
    descricao TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'em_analise', 'resolvida', 'cancelada')),
    foto_s3_key VARCHAR(500),
    miniatura_s3_key VARCHAR(500),
    rotulos JSONB DEFAULT '[]'::jsonb,
    criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizada_em TIMESTAMPTZ DEFAULT NOW()
);

-- Relatórios gerenciais
CREATE TABLE IF NOT EXISTS relatorios (
    id VARCHAR(50) PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL,
    periodo VARCHAR(50) NOT NULL,
    s3_key VARCHAR(500) NOT NULL,
    gerado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadados JSONB DEFAULT '{}'::jsonb
);

-- Seeds iniciais para desenvolvimento
INSERT INTO zonas (id, nome, geometria) VALUES
    ('zona-centro', 'Centro Histórico', '{"lat": -23.5505, "lng": -46.6333, "raio_km": 3}'::jsonb),
    ('zona-sul', 'Zona Sul Empresarial', '{"lat": -23.6000, "lng": -46.6800, "raio_km": 5}'::jsonb),
    ('zona-norte', 'Zona Norte Residencial', '{"lat": -23.5000, "lng": -46.6200, "raio_km": 4}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO sensores (id, tipo, zona_id, status) VALUES
    ('poll-0001', 'poluicao', 'zona-centro', 'ativo'),
    ('poll-0002', 'poluicao', 'zona-sul', 'ativo'),
    ('traf-0001', 'transito', 'zona-centro', 'ativo'),
    ('traf-0002', 'transito', 'zona-sul', 'ativo'),
    ('cam-0001', 'camera', 'zona-centro', 'ativo')
ON CONFLICT (id) DO NOTHING;

INSERT INTO regras_alerta (id, tipo_sensor, metrica, operador, limiar, janela_s, severidade, descricao) VALUES
    ('regra-pm25-alta', 'poluicao', 'pm25', '>=', 50.0, 60, 'alta', 'PM2.5 acima de 50 ug/m3'),
    ('regra-pm25-critica', 'poluicao', 'pm25', '>=', 80.0, 60, 'critica', 'PM2.5 acima de 80 ug/m3 crítico'),
    ('regra-transito-lento', 'transito', 'velocidade', '<=', 15.0, 120, 'media', 'Velocidade média menor ou igual a 15 km/h')
ON CONFLICT (id) DO NOTHING;

