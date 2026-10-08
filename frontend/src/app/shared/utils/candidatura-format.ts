import { FormatoEntrevista, StatusCandidatura } from '../types/vaga';

/**
 * Rótulo da etapa da candidatura. A empresa vê "Nova" para o que acabou de
 * chegar; o candidato vê "Enviada" — o resto é igual para os dois lados.
 */
export function formatarStatusCandidatura(status: StatusCandidatura, visao: 'empresa' | 'candidato'): string {
  switch (status) {
    case 'EM_ANALISE':
      return 'Em análise';
    case 'ENTREVISTA':
      return 'Entrevista';
    case 'APROVADO':
      return visao === 'empresa' ? 'Contratado' : 'Aprovado';
    case 'REPROVADO':
      return visao === 'empresa' ? 'Não selecionado' : 'Encerrada';
    default:
      return visao === 'empresa' ? 'Nova' : 'Enviada';
  }
}

/** Cor do marcador (bolinha) da etapa da candidatura. */
export function corStatusCandidatura(status: StatusCandidatura): string {
  switch (status) {
    case 'EM_ANALISE':
      return 'bg-amber-400';
    case 'ENTREVISTA':
      return 'bg-sky-400';
    case 'APROVADO':
      return 'bg-emerald-400';
    case 'REPROVADO':
      return 'bg-rose-400';
    default:
      return 'bg-brand-400';
  }
}

export function formatarFormatoEntrevista(formato: FormatoEntrevista): string {
  return formato === 'REMOTA' ? 'Remota (online)' : 'Presencial';
}

/** "Hoje, 14:32", "Ontem, 09:10", "Amanhã, 10:00" ou "05/10/2026, 14:32". */
export function formatarDataHora(data: string): string {
  const momento = new Date(data);
  const hora = momento.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);
  const amanha = new Date();
  amanha.setDate(hoje.getDate() + 1);

  if (momento.toDateString() === hoje.toDateString()) {
    return `Hoje, ${hora}`;
  }
  if (momento.toDateString() === ontem.toDateString()) {
    return `Ontem, ${hora}`;
  }
  if (momento.toDateString() === amanha.toDateString()) {
    return `Amanhã, ${hora}`;
  }

  return `${momento.toLocaleDateString('pt-BR')}, ${hora}`;
}

/** "Seg., 12 de out. de 2026 às 14:00" — usado para a data da entrevista. */
export function formatarDataEntrevista(data: string): string {
  const momento = new Date(data);
  const dia = momento.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  const hora = momento.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} às ${hora}`;
}

/** "2026-11-03" → "03/11/2026", sem passar por Date (evita o dia "voltar" por causa do fuso). */
export function formatarDataSimples(data: string): string {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}
