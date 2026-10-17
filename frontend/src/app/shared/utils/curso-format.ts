import { NivelCurso } from '../types/curso';

/** Formata a carga horária de um curso para exibição. */
export function formatarCargaHorariaCurso(cargaHoraria: number | null): string {
  return cargaHoraria !== null ? `${cargaHoraria} horas` : 'Carga horária não informada';
}

/** Formata o preço de um curso em reais, ou "Gratuito" quando nulo/zero. */
export function formatarPrecoCurso(preco: number | null): string {
  if (preco === null || preco === 0) {
    return 'Gratuito';
  }

  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(preco);
}

export function formatarNivelCurso(nivel: NivelCurso | null): string {
  switch (nivel) {
    case 'INICIANTE':
      return 'Iniciante';
    case 'INTERMEDIARIO':
      return 'Intermediário';
    case 'AVANCADO':
      return 'Avançado';
    default:
      return 'Não informado';
  }
}

export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}
