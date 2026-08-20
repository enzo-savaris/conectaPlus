export interface PerfilUsuario {
  id: number;
  nome: string;
  email: string | null;
  cpf: string;
  status: string;
}

export interface PerfilEmpresa {
  id: number;
  razaoSocial: string;
  nomeFantasia: string | null;
  email: string | null;
  cnpj: string;
  status: string;
}

/** Sessão devolvida pelo login: o ambiente já resolvido pelo backend a partir do documento. */
export type Sessao =
  | { ambiente: 'usuario'; perfil: PerfilUsuario }
  | { ambiente: 'empresa'; perfil: PerfilEmpresa };
