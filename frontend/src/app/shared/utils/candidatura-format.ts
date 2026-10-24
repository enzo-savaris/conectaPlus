import { FormatoEntrevista, StatusCandidatura } from '../types/vaga';

const ROTULOS: Record<StatusCandidatura, { empresa: string; candidato: string }> = {
  PENDENTE: { empresa: 'Nova', candidato: 'Enviada' },
  EM_ANALISE: { empresa: 'Em análise', candidato: 'Em análise' },
  ENTREVISTA: { empresa: 'Entrevista agendada', candidato: 'Entrevista' },
  ENTREVISTA_REALIZADA: { empresa: 'Entrevista realizada', candidato: 'Entrevista realizada' },
  PROPOSTA: { empresa: 'Proposta enviada', candidato: 'Proposta recebida' },
  APROVADO: { empresa: 'Contratado', candidato: 'Contratado' },
  REPROVADO: { empresa: 'Não selecionado', candidato: 'Encerrada' },
  DESISTIU: { empresa: 'Recusou a proposta', candidato: 'Proposta recusada' }
};

const CORES: Record<StatusCandidatura, string> = {
  PENDENTE: 'bg-brand-400',
  EM_ANALISE: 'bg-amber-400',
  ENTREVISTA: 'bg-sky-400',
  ENTREVISTA_REALIZADA: 'bg-indigo-400',
  PROPOSTA: 'bg-fuchsia-400',
  APROVADO: 'bg-emerald-400',
  REPROVADO: 'bg-rose-400',
  DESISTIU: 'bg-slate-400'
};

/**
 * Rótulo da etapa da candidatura. Algumas mudam conforme quem lê: a empresa
 * vê "Nova" e "Proposta enviada"; o candidato, "Enviada" e "Proposta recebida".
 */
export function formatarStatusCandidatura(status: StatusCandidatura, visao: 'empresa' | 'candidato'): string {
  return ROTULOS[status]?.[visao] ?? status;
}

/** Cor do marcador (bolinha) da etapa da candidatura. */
export function corStatusCandidatura(status: StatusCandidatura): string {
  return CORES[status] ?? 'bg-slate-400';
}

/** A candidatura já terminou (contratado, não selecionado ou recusou a proposta). */
export function processoEncerrado(status: StatusCandidatura): boolean {
  return status === 'APROVADO' || status === 'REPROVADO' || status === 'DESISTIU';
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

export function formatarSalario(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}
