export type ModeloTrabalho = 'PRESENCIAL' | 'HIBRIDO' | 'REMOTO';

export type TipoContratacao = 'CLT' | 'PJ' | 'ESTAGIO' | 'TEMPORARIO' | 'FREELANCER';

export type StatusVaga = 'ATIVA' | 'INATIVA' | 'ENCERRADA';

/** Vaga publicada por uma empresa, como usada nas telas do sistema. */
export interface Vaga {
  id: number;
  idEmpresa: number;
  titulo: string;
  area: string | null;
  descricao: string;
  cidade: string | null;
  estado: string | null;
  modeloTrabalho: ModeloTrabalho;
  tipoContratacao: TipoContratacao;
  salarioMinimo: number | null;
  salarioMaximo: number | null;
  dataCadastro: string;
  status: StatusVaga;
}

/** Dados enviados ao cadastrar uma vaga nova. */
export interface NovaVaga {
  titulo: string;
  area: string | null;
  descricao: string;
  cidade: string | null;
  estado: string | null;
  modeloTrabalho: ModeloTrabalho;
  tipoContratacao: TipoContratacao;
  salarioMinimo: number | null;
  salarioMaximo: number | null;
  responsabilidades: string[];
  requisitos: string[];
  acessibilidade: string[];
  beneficios: string[];
}
