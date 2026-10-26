export type TipoSensor = 'poluicao' | 'transito' | 'camera';

export type SeveridadeAlerta = 'baixa' | 'media' | 'alta' | 'critica';

export type StatusAlerta = 'ABERTO' | 'RECONHECIDO' | 'RESOLVIDO' | 'AUTO_RESOLVIDO';

export interface TelemetriaEvento {
  schemaVersion: number;
  eventId: string;
  sensorId: string;
  tipo: TipoSensor;
  zona: string;
  ocorridoEm: string; // ISO 8601
  medidas: Record<string, number>;
  bateria?: number;
}

export interface AlertaEvento {
  id: string;
  regraId?: string;
  sensorId: string;
  zonaId: string;
  tipoSensor: TipoSensor;
  metrica: string;
  valorLido: number;
  limiarOuEsperado: number;
  zScore?: number;
  severidade: SeveridadeAlerta;
  abertoEm: string;
  dedupeKey: string;
}

export interface EstadoDetectorSnapshot {
  media: number;
  variancia: number;
  n: number;
  atualizadoEm: string;
}

