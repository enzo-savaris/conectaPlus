export type StatusEmpresaAdmin = 'PENDENTE' | 'ATIVA' | 'INATIVA' | 'RECUSADA';

export type AcaoEmpresaAdmin = 'APROVAR' | 'RECUSAR' | 'INATIVAR';

/** Empresa como aparece na fila de validação. */
export interface EmpresaAdmin {
  id: number;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  email: string | null;
  telefone: string | null;
  cep: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  dataCadastro: string;
  /** Última alteração dos dados pela empresa (ex.: trocou CNPJ e voltou para a fila). */
  dataAlteracao: string | null;
  status: StatusEmpresaAdmin;
}

/** Uma decisão da equipe sobre a empresa. */
export interface DecisaoEmpresa {
  statusAnterior: StatusEmpresaAdmin | null;
  statusNovo: StatusEmpresaAdmin;
  motivo: string | null;
  data: string;
  nomeAdmin: string | null;
}

export interface EmpresaAdminDetalhada extends EmpresaAdmin {
  historico: DecisaoEmpresa[];
  totalVagas: number;
  totalCursos: number;
  /** Outras empresas com o mesmo e-mail ou telefone — vale conferir. */
  semelhantes: { id: number; razaoSocial: string; cnpj: string; status: StatusEmpresaAdmin }[];
}

export interface MembroEquipe {
  id: number;
  nome: string;
  email: string;
  ativo: boolean;
  dataCadastro: string;
  ultimoAcesso: string | null;
  totalDecisoes: number;
}
