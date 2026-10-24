export type TipoConteudoCurso = 'LINK' | 'ARQUIVO';

export type StatusCurso = 'ATIVO' | 'INATIVO';

export type NivelCurso = 'INICIANTE' | 'INTERMEDIARIO' | 'AVANCADO';

/** Uma aula dentro de um módulo — tem o próprio conteúdo (link ou vídeo anexado). */
export interface CapituloCurso {
  id: number;
  titulo: string;
  descricao: string | null;
  tipoConteudo: TipoConteudoCurso;
  /** Só preenchido quando `tipoConteudo` é LINK. */
  linkCapitulo: string | null;
  /** Só preenchido quando `tipoConteudo` é ARQUIVO: URL completa já pronta pra abrir/baixar. */
  arquivoCapituloUrl: string | null;
  /** Material de apoio opcional (ex.: slides), à parte do conteúdo principal — URL já pronta pra abrir/baixar. */
  materialUrl: string | null;
}

/** Um módulo do curso, com suas aulas na ordem de cadastro. */
export interface ModuloCurso {
  id: number;
  titulo: string;
  /** Horas do módulo; `null` quando a empresa não informou. */
  cargaHoraria: number | null;
  capitulos: CapituloCurso[];
}

/** Curso cadastrado por uma empresa, recomendado aos candidatos junto das vagas. */
export interface Curso {
  id: number;
  idEmpresa: number;
  nomeEmpresa: string;
  titulo: string;
  descricao: string | null;
  cargaHoraria: number | null;
  preco: number | null;
  dataCadastro: string;
  status: StatusCurso;
  nivel: NivelCurso | null;
  certificado: boolean;
  /** Média das notas (1 a 5), ou `null` sem nenhuma avaliação. */
  avaliacaoMedia: number | null;
  totalAvaliacoes: number;
}

export type StatusMatricula = 'PENDENTE' | 'ATIVA' | 'CANCELADA';

/** Curso com os módulos e capítulos — usado na tela de detalhes e na edição. */
export interface CursoDetalhado extends Curso {
  aprendizados: string[];
  skills: string[];
  modulos: ModuloCurso[];
  /**
   * Se os links/arquivos das aulas vieram na resposta: curso gratuito,
   * matrícula ATIVA (pago) ou empresa dona. Sem isso, as aulas vêm só com o título.
   */
  conteudoLiberado: boolean;
  /** Matrícula do candidato que pediu o curso (só quando consultado com o id dele). */
  matricula: { id: number; status: StatusMatricula; dataConclusao: string | null } | null;
  minhaAvaliacao: { nota: number; comentario: string | null } | null;
}

export type MetodoPagamento = 'PIX' | 'CARTAO';

export type StatusPagamento = 'PENDENTE' | 'APROVADO' | 'RECUSADO' | 'CANCELADO' | 'ESTORNADO';

/** Uma tentativa de pagamento da matrícula, como devolvida pela API. */
export interface PagamentoCurso {
  id: number;
  metodo: MetodoPagamento;
  valor: number;
  parcelas: number;
  status: StatusPagamento;
  /** Motivo do Mercado Pago (ex.: cc_rejected_insufficient_amount). */
  detalheStatus: string | null;
  pixCopiaECola: string | null;
  /** Imagem do QR Code em base64 (PNG). */
  pixQrCodeBase64: string | null;
  pixExpiracao: string | null;
  cartaoBandeira: string | null;
  cartaoFinal: string | null;
  statusMatricula: StatusMatricula;
}

/** Matrícula do candidato num curso, com os dados usados no fluxo de matrícula. */
export interface MatriculaCurso {
  id: number;
  idCurso: number;
  tituloCurso: string;
  nomeEmpresa: string;
  cargaHoraria: number | null;
  nivel: NivelCurso | null;
  certificado: boolean;
  valor: number;
  status: StatusMatricula;
  necessidades: string[];
  observacao: string | null;
  pagamento: PagamentoCurso | null;
}

/** Dados do pagamento com cartão: o cartão em si já virou `token` no navegador, direto com o Mercado Pago. */
export interface PagamentoCartao {
  token: string;
  bandeira: string;
  idEmissor: string | null;
  parcelas: number;
  email: string;
  tipoDocumento: string;
  numeroDocumento: string;
}

/**
 * Uma aula a cadastrar/editar: o vídeo e o material (quando presentes) viajam
 * à parte, indexados por módulo/capítulo. A descrição é opcional.
 */
export interface NovoCapitulo {
  titulo: string;
  descricao: string | null;
  tipoConteudo: TipoConteudoCurso;
  linkCapitulo: string | null;
  /** Novo arquivo a enviar; `null` na edição mantém o arquivo já cadastrado. */
  arquivo: File | null;
  /** Nome do arquivo já cadastrado (edição), mantido quando nenhum arquivo novo é escolhido. */
  arquivoAtual: string | null;
  /** Novo material de apoio a enviar (opcional, qualquer tipo); `null` mantém o já cadastrado. */
  material: File | null;
  /** Nome do material já cadastrado (edição), mantido quando nenhum material novo é escolhido. */
  materialAtual: string | null;
}

export interface NovoModulo {
  titulo: string;
  cargaHoraria: number | null;
  capitulos: NovoCapitulo[];
}

/** Dados enviados ao cadastrar ou editar um curso, módulos e capítulos inclusos. */
export interface NovoCurso {
  titulo: string;
  descricao: string | null;
  cargaHoraria: number | null;
  preco: number | null;
  nivel: NivelCurso | null;
  certificado: boolean;
  aprendizados: string[];
  skills: string[];
  modulos: NovoModulo[];
}

/** Aluno inscrito num curso, como a empresa dona vê na tela de detalhes do curso. */
export interface InscritoCurso {
  idMatricula: number;
  idCandidato: number;
  nome: string;
  email: string | null;
  statusMatricula: StatusMatricula;
  valor: number;
  dataMatricula: string;
  dataAtivacao: string | null;
  dataConclusao: string | null;
  /** Último pagamento relevante (o aprovado, se houver); `null` em curso gratuito ou sem tentativa. */
  pagamento: { metodo: MetodoPagamento; status: StatusPagamento; parcelas: number; data: string } | null;
  necessidades: string[];
}
