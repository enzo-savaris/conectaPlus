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

/** Membro da equipe Conecta+ (ambiente /admin). */
export interface PerfilAdmin {
  id: number;
  nome: string;
  email: string;
}

/**
 * Sessão devolvida pelo login. Candidato e empresa: o ambiente vem resolvido
 * pelo backend a partir do documento. Equipe: login próprio (/admin/login),
 * com um token assinado pelo servidor que vai em toda chamada à API /admin.
 */
export type Sessao =
  | { ambiente: 'usuario'; perfil: PerfilUsuario }
  | { ambiente: 'empresa'; perfil: PerfilEmpresa }
  | { ambiente: 'admin'; perfil: PerfilAdmin; token: string };

export type AmbienteSessao = Sessao['ambiente'];
