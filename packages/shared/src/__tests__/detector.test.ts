import { describe, it, expect } from 'vitest';
import { DetectorEwma } from '../detector';

describe('DetectorEwma', () => {
  it('não deve disparar anomalia durante o período de aquecimento', () => {
    const detector = new DetectorEwma(0.1, 4, 30);
    for (let i = 0; i < 29; i++) {
      const { anomalia } = detector.avaliar(20 + (i % 2));
      expect(anomalia).toBe(false);
    }
  });

  it('deve disparar anomalia quando o valor ultrapassar o z-score limite após o aquecimento', () => {
    const detector = new DetectorEwma(0.1, 3, 10);
    // Aquecimento com valores estáveis em torno de 20
    for (let i = 0; i < 15; i++) {
      detector.avaliar(20);
    }

    // Salto brusco (ex: pico de poluição ou evento anômalo)
    const resultado = detector.avaliar(150);
    expect(resultado.anomalia).toBe(true);
    expect(resultado.z).toBeGreaterThan(3);
  });

  it('deve permitir exportar e restaurar o estado do detector para persistência', () => {
    const detector1 = new DetectorEwma(0.1, 4, 10);
    for (let i = 0; i < 12; i++) {
      detector1.avaliar(25);
    }

    const snapshot = detector1.exportarEstado();
    expect(snapshot.n).toBe(12);

    const detector2 = new DetectorEwma(0.1, 4, 10);
    detector2.carregarEstado(snapshot);
    const estadoRestaurado = detector2.exportarEstado();

    expect(estadoRestaurado.n).toBe(12);
    expect(estadoRestaurado.media).toBeCloseTo(snapshot.media);
  });
});

