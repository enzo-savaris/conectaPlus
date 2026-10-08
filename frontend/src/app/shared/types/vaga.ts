export type ModeloTrabalho = 'PRESENCIAL' | 'HIBRIDO' | 'REMOTO';

export type TipoContratacao = 'CLT' | 'PJ' | 'ESTAGIO' | 'TEMPORARIO' | 'FREELANCER';

export type StatusVaga = 'ATIVA' | 'INATIVA' | 'ENCERRADA';

/** Vaga publicada por uma empresa, como usada nas telas do sistema. */
export interface Vaga {
  id: number;
  idEmpresa: number;
  nomeEmpresa: string;
  titulo: string;
  area: string | null;
  descricao: string;
  /** Escolhida no combobox de cidades no cadastro; `null` em vagas sem cidade informada. */
  idCidade: number | null;
  cidade: string | null;
  estado: string | null;
  modeloTrabalho: ModeloTrabalho;
  tipoContratacao: TipoContratacao;
  salarioMinimo: number | null;
  salarioMaximo: number | null;
  dataCadastro: string;
  status: StatusVaga;
}

/**
 * Curso recomendado por uma vaga, como mostrado no card "Cursos recomendados"
 * da página da vaga — o conteúdo (módulos/capítulos) mora na tela do próprio
 * curso; o card só linka pra lá pelo `id`.
 */
export interface CursoRecomendado {
  id: number;
  titulo: string;
  cargaHoraria: number | null;
  preco: number | null;
}

/** Vaga com as listas de itens do cadastro, usada para preencher a tela de edição. */
export interface VagaDetalhada extends Vaga {
  responsabilidades: string[];
  requisitos: string[];
  acessibilidade: string[];
  beneficios: string[];
  /** Perguntas que a empresa faz a quem se candidata (card "Perguntas da empresa"). */
  perguntas: string[];
  cursosRecomendados: CursoRecomendado[];
}

/**
 * Etapas do processo seletivo: PENDENTE (recebida) → EM_ANALISE → ENTREVISTA
 * → APROVADO (contratado) ou REPROVADO (encerrada).
 */
export type StatusCandidatura = 'PENDENTE' | 'EM_ANALISE' | 'ENTREVISTA' | 'APROVADO' | 'REPROVADO';

export type FormatoEntrevista = 'REMOTA' | 'PRESENCIAL';

/** Entrevista agendada pela empresa na plataforma. */
export interface EntrevistaAgendada {
  data: string;
  formato: FormatoEntrevista;
  /** Link da chamada (REMOTA) ou endereço (PRESENCIAL). */
  local: string;
  observacoes: string | null;
}

/** Momento em que a candidatura entrou numa etapa. */
export interface HistoricoEtapa {
  status: StatusCandidatura;
  data: string;
}

/** Andamento do processo seletivo, visto tanto pela empresa quanto pelo candidato. */
export interface ProcessoSeletivo {
  status: StatusCandidatura;
  dataCandidatura: string;
  entrevista: EntrevistaAgendada | null;
  /** "AAAA-MM-DD", informada ao contratar. */
  dataInicio: string | null;
  /** Mensagem da empresa no resultado final (contratação ou encerramento). */
  mensagemEmpresa: string | null;
  historico: HistoricoEtapa[];
}

/** Resposta do candidato a uma das perguntas da vaga. */
export interface RespostaPergunta {
  pergunta: string;
  resposta: string;
}

/** Adaptações de acessibilidade que o candidato pediu para o processo seletivo. */
export interface AdaptacoesCandidatura {
  entrevistaRemota: boolean;
  tempoEstendido: boolean;
  interpreteLibras: boolean;
}

/** Inscrição de um candidato PCD em uma vaga, como exibida na tela de detalhes da vaga. */
export interface Candidatura {
  id: number;
  idCandidato: number;
  nome: string;
  email: string | null;
  sobreMim: string | null;
  status: StatusCandidatura;
  dataCandidatura: string;
  cartaApresentacao: string | null;
  /** Currículo anexado na candidatura ou, se não houver, o PDF do perfil. */
  curriculoPdfUrl: string | null;
  adaptacoes: AdaptacoesCandidatura;
  inicioImediato: boolean;
  respostas: RespostaPergunta[];
}

/** Dados enviados pela tela "Candidatar-se". */
export interface EnvioCandidatura {
  cartaApresentacao: string;
  adaptacoes: AdaptacoesCandidatura;
  aceiteTermos: boolean;
  inicioImediato: boolean;
  respostas: RespostaPergunta[];
  /** PDF só para esta vaga; `null` usa o currículo do perfil. */
  curriculoPdf: File | null;
}

/** Candidatura do candidato logado, como mostrada na tela de acompanhamento. */
export interface AcompanhamentoCandidatura extends ProcessoSeletivo {
  id: number;
  idVaga: number;
  tituloVaga: string;
  nomeEmpresa: string;
  adaptacoes: AdaptacoesCandidatura;
}

/** Candidatura completa, como a empresa vê na tela "Gerenciar candidatura". */
export interface CandidaturaGestao extends ProcessoSeletivo {
  id: number;
  idVaga: number;
  tituloVaga: string;
  modeloTrabalho: ModeloTrabalho;
  candidato: {
    id: number;
    nome: string;
    email: string | null;
    telefone: string | null;
    tipoDeficiencia: string;
    cidade: string | null;
    estado: string | null;
    avatarUrl: string | null;
    tituloProfissional: string | null;
  };
  cartaApresentacao: string | null;
  curriculoPdfUrl: string | null;
  adaptacoes: AdaptacoesCandidatura;
  inicioImediato: boolean;
  respostas: RespostaPergunta[];
}

/** Ações da empresa sobre a candidatura, cada uma levando a uma etapa. */
export type AcaoCandidatura =
  | { acao: 'INICIAR_ANALISE' }
  | {
      acao: 'AGENDAR_ENTREVISTA';
      /** Valor do <input type="datetime-local">. */
      dataEntrevista: string;
      formatoEntrevista: FormatoEntrevista;
      localEntrevista: string;
      observacoesEntrevista: string;
    }
  | { acao: 'CONTRATAR'; dataInicio: string; mensagem: string }
  | { acao: 'REPROVAR'; mensagem: string };

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
  idCidade: number | null;
  modeloTrabalho: ModeloTrabalho;
  tipoContratacao: TipoContratacao;
  salarioMinimo: number | null;
  salarioMaximo: number | null;
  responsabilidades: string[];
  requisitos: string[];
  acessibilidade: string[];
  beneficios: string[];
  perguntas: string[];
  cursosRecomendados: number[];
}
