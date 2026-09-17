import { TipoDeficiencia } from '../types/candidato';

/** Formata o tipo de deficiência do candidato para exibição. */
export function formatarTipoDeficiencia(tipo: TipoDeficiencia): string {
  switch (tipo) {
    case 'FISICA':
      return 'Deficiência física';
    case 'AUDITIVA':
      return 'Deficiência auditiva';
    case 'VISUAL':
      return 'Deficiência visual';
    case 'INTELECTUAL':
      return 'Deficiência intelectual';
    case 'MULTIPLA':
      return 'Deficiência múltipla';
    default:
      return 'Outra deficiência';
  }
}
