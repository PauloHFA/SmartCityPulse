import { z } from 'zod';

export const TelemetriaEventoSchema = z.object({
  schemaVersion: z.number().int().min(1),
  eventId: z.string().min(1),
  sensorId: z.string().min(1),
  tipo: z.enum(['poluicao', 'transito', 'camera']),
  zona: z.string().min(1),
  ocorridoEm: z.string().datetime(),
  medidas: z.record(z.string(), z.number()),
  bateria: z.number().min(0).max(100).optional(),
});

export const CriarOcorrenciaSchema = z.object({
  usuarioId: z.string().min(1),
  tipo: z.string().min(1),
  descricao: z.string().min(5),
  latitude: z.number(),
  longitude: z.number(),
  fotoNome: z.string().optional(),
});

