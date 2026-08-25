export type StatusEmpresa = 'ATIVA' | 'INATIVA' | 'PENDENTE';

/** Dados completos da empresa, usados na tela de perfil. */
export interface Empresa {
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
  dataAlteracao: string | null;
  status: StatusEmpresa;
}

/** Campos editáveis na tela de perfil. `senha` só é enviada quando preenchida. */
export interface AtualizarEmpresa {
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
  senha?: string;
}
