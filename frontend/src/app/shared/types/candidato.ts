export type TipoDeficiencia = 'FISICA' | 'AUDITIVA' | 'VISUAL' | 'INTELECTUAL' | 'MULTIPLA' | 'OUTRA';

/** Dados enviados ao cadastrar um candidato PCD (tela de "Criar conta"). */
export interface NovoCandidato {
  nome: string;
  email: string;
  telefone: string;
  cpf: string;
  senha: string;
  tipoDeficiencia: TipoDeficiencia;
  recursos: string[];
  interesses: string[];
  /** Foto de perfil, opcional — `null` mantém o ícone de placeholder. */
  avatar: File | null;
}

/** Candidato PCD já inscrito em alguma vaga da empresa, exibido na tela de Candidatos. */
export interface CandidatoRelacionado {
  id: number;
  nome: string;
  email: string | null;
  telefone: string | null;
  sobreMim: string | null;
  tipoDeficiencia: TipoDeficiencia;
  cidade: string | null;
  estado: string | null;
}

export type TipoCurriculo = 'PLATAFORMA' | 'PDF';

/** Uma experiência profissional do currículo montado pela plataforma. */
export interface ExperienciaCandidato {
  id: number;
  cargo: string;
  empresa: string;
  periodo: string | null;
  descricao: string | null;
}

/** Uma formação acadêmica do currículo montado pela plataforma. */
export interface FormacaoCandidato {
  id: number;
  curso: string;
  instituicao: string;
  periodo: string | null;
}

/** Perfil completo do candidato PCD — usado tanto no autoatendimento quanto na visão da empresa. */
export interface PerfilCandidato {
  id: number;
  nome: string;
  email: string | null;
  telefone: string | null;
  cpf: string;
  sobreMim: string | null;
  tituloProfissional: string | null;
  tipoDeficiencia: TipoDeficiencia;
  cidade: string | null;
  estado: string | null;
  avatarUrl: string | null;
  tipoCurriculo: TipoCurriculo;
  curriculoPdfUrl: string | null;
  recursos: string[];
  interesses: string[];
  habilidades: string[];
  experiencias: ExperienciaCandidato[];
  formacoes: FormacaoCandidato[];
  dataCadastro: string;
  status: string;
}

/** Uma experiência ainda sendo editada no formulário, antes de salvar (sem id). */
export interface ExperienciaEmEdicao {
  cargo: string;
  empresa: string;
  periodo: string;
  descricao: string;
}

/** Uma formação ainda sendo editada no formulário, antes de salvar (sem id). */
export interface FormacaoEmEdicao {
  curso: string;
  instituicao: string;
  periodo: string;
}

/** Dados enviados ao salvar o perfil do candidato — todos opcionais, só o que mudou é enviado. */
export interface AtualizarPerfilCandidato {
  nome?: string;
  email?: string;
  telefone?: string;
  senha?: string;
  tituloProfissional?: string | null;
  sobreMim?: string | null;
  cidade?: string | null;
  estado?: string | null;
  tipoDeficiencia?: TipoDeficiencia;
  recursos?: string[];
  interesses?: string[];
  tipoCurriculo?: TipoCurriculo;
  habilidades?: string[];
  experiencias?: ExperienciaEmEdicao[];
  formacoes?: FormacaoEmEdicao[];
  /** Nova foto de perfil; `undefined` mantém a atual. */
  avatar?: File;
  /** Novo currículo em PDF; `undefined` mantém o atual. */
  curriculoPdf?: File;
}
