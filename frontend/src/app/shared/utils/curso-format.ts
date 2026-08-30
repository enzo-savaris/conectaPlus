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
