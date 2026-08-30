import { TipoConteudoCurso } from './curso';

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

/** Curso recomendado por uma vaga, como mostrado no card "Cursos recomendados" da página da vaga. */
export interface CursoRecomendado {
  id: number;
  titulo: string;
  cargaHoraria: number | null;
  preco: number | null;
  tipoConteudo: TipoConteudoCurso;
  linkCurso: string | null;
  arquivoCursoUrl: string | null;
}

/** Vaga com as listas de itens do cadastro, usada para preencher a tela de edição. */
export interface VagaDetalhada extends Vaga {
  responsabilidades: string[];
  requisitos: string[];
  acessibilidade: string[];
  beneficios: string[];
  cursosRecomendados: CursoRecomendado[];
}

export type StatusCandidatura = 'PENDENTE' | 'EM_ANALISE' | 'APROVADO' | 'REPROVADO';

/** Inscrição de um candidato PCD em uma vaga, como exibida na tela de detalhes da vaga. */
export interface Candidatura {
  id: number;
  idCandidato: number;
  nome: string;
  email: string | null;
  sobreMim: string | null;
  status: StatusCandidatura;
  dataCandidatura: string;
}

/** Candidatura do próprio candidato logado, como exibida na tela de vagas disponíveis. */
export interface MinhaCandidatura {
  idVaga: number;
  titulo: string;
  status: StatusCandidatura;
  dataCandidatura: string;
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
  cursosRecomendados: number[];
}
