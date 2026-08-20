import { Vaga } from '../types/vaga';

/** Formata o modelo de trabalho da vaga para exibição. */
export function formatarModeloTrabalho(modelo: Vaga['modeloTrabalho']): string {
  switch (modelo) {
    case 'HIBRIDO':
      return 'Híbrido';
    case 'REMOTO':
      return 'Remoto';
    default:
      return 'Presencial';
  }
}

/** Combina cidade, estado e modelo de trabalho em uma única linha legível. */
export function formatarLocalizacaoVaga(vaga: Vaga): string {
  const partes = [vaga.cidade, vaga.estado].filter((parte): parte is string => !!parte);
  const local = partes.length > 0 ? partes.join(' - ') : 'Local não informado';

  return `${local} (${formatarModeloTrabalho(vaga.modeloTrabalho)})`;
}

/** Formata a faixa salarial da vaga em reais, ou `null` quando não informada. */
export function formatarSalarioVaga(vaga: Vaga): string | null {
  if (vaga.salarioMinimo === null && vaga.salarioMaximo === null) {
    return null;
  }

  const formatador = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  if (vaga.salarioMinimo !== null && vaga.salarioMaximo !== null) {
    return `${formatador.format(vaga.salarioMinimo)} - ${formatador.format(vaga.salarioMaximo)}`;
  }

  if (vaga.salarioMinimo !== null) {
    return `A partir de ${formatador.format(vaga.salarioMinimo)}`;
  }

  return `Até ${formatador.format(vaga.salarioMaximo!)}`;
}
