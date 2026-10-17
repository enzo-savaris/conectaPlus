import { StatusEmpresaAdmin } from '../types/admin';

export const ROTULO_STATUS_EMPRESA: Record<StatusEmpresaAdmin, string> = {
  PENDENTE: 'Pendente',
  ATIVA: 'Ativa',
  INATIVA: 'Inativa',
  RECUSADA: 'Recusada'
};

/** Classes do selo de status (cor do fundo, borda e texto). */
export const CLASSE_STATUS_EMPRESA: Record<StatusEmpresaAdmin, string> = {
  PENDENTE: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
  ATIVA: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
  INATIVA: 'border-slate-400/40 bg-slate-400/10 text-slate-300',
  RECUSADA: 'border-rose-400/40 bg-rose-400/10 text-rose-200'
};

/** "05/10/2026 às 14:32". */
export function formatarDataHoraCompleta(data: string): string {
  const momento = new Date(data);
  return `${momento.toLocaleDateString('pt-BR')} às ${momento.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

/** "há 3 dias", "hoje" — quanto tempo a empresa está esperando na fila. */
export function formatarEspera(data: string): string {
  const dias = Math.floor((Date.now() - new Date(data).getTime()) / 86_400_000);
  if (dias <= 0) {
    return 'hoje';
  }
  return dias === 1 ? 'há 1 dia' : `há ${dias} dias`;
}
