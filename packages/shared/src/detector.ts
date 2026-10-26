import { EstadoDetectorSnapshot } from './types';

/**
 * Detector de Anomalias Estatístico com EWMA (Exponentially Weighted Moving Average) e z-score.
 * Implementação fiel ao documento de arquitetura (Seção 8.1).
 * Não normaliza a anomalia (só atualiza média/variância com valores não anômalos).
 */
export class DetectorEwma {
  private media = 0;
  private variancia = 0;
  private n = 0;

  constructor(
    private alfa = 0.1,
    private limiteZ = 4,
    private aquecimento = 30
  ) {}

  public avaliar(valor: number): { anomalia: boolean; z: number } {
    if (this.n === 0) {
      this.media = valor;
      this.n = 1;
      return { anomalia: false, z: 0 };
    }

    const desvio = Math.sqrt(this.variancia) || 1e-9;
    const z = (valor - this.media) / desvio;
    const anomalia = this.n >= this.aquecimento && Math.abs(z) > this.limiteZ;

    // Só aprende com valores normais para não normalizar a anomalia
    if (!anomalia) {
      const delta = valor - this.media;
      this.media += this.alfa * delta;
      this.variancia = (1 - this.alfa) * (this.variancia + this.alfa * delta * delta);
    }
    this.n++;

    return { anomalia, z };
  }

  public exportarEstado(): EstadoDetectorSnapshot {
    return {
      media: this.media,
      variancia: this.variancia,
      n: this.n,
      atualizadoEm: new Date().toISOString(),
    };
  }

  public carregarEstado(estado: Partial<EstadoDetectorSnapshot>): void {
    if (estado.media !== undefined) this.media = estado.media;
    if (estado.variancia !== undefined) this.variancia = estado.variancia;
    if (estado.n !== undefined) this.n = estado.n;
  }
}

