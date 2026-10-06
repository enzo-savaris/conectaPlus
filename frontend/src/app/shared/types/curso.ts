export type TipoConteudoCurso = 'LINK' | 'ARQUIVO';

export type StatusCurso = 'ATIVO' | 'INATIVO';

/** Uma aula dentro de um módulo — tem o próprio conteúdo (link ou vídeo anexado). */
export interface CapituloCurso {
  id: number;
  titulo: string;
  tipoConteudo: TipoConteudoCurso;
  /** Só preenchido quando `tipoConteudo` é LINK. */
  linkCapitulo: string | null;
  /** Só preenchido quando `tipoConteudo` é ARQUIVO: URL completa já pronta pra abrir/baixar. */
  arquivoCapituloUrl: string | null;
}

/** Um módulo do curso, com suas aulas na ordem de cadastro. */
export interface ModuloCurso {
  id: number;
  titulo: string;
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
}

/** Curso com os módulos e capítulos — usado na tela de detalhes e na edição. */
export interface CursoDetalhado extends Curso {
  modulos: ModuloCurso[];
}

/** Uma aula a cadastrar/editar: o vídeo (quando ARQUIVO) viaja à parte, indexado por módulo/capítulo. */
export interface NovoCapitulo {
  titulo: string;
  tipoConteudo: TipoConteudoCurso;
  linkCapitulo: string | null;
  /** Novo arquivo a enviar; `null` na edição mantém o arquivo já cadastrado. */
  arquivo: File | null;
  /** Nome do arquivo já cadastrado (edição), mantido quando nenhum arquivo novo é escolhido. */
  arquivoAtual: string | null;
}

export interface NovoModulo {
  titulo: string;
  capitulos: NovoCapitulo[];
}

/** Dados enviados ao cadastrar ou editar um curso, módulos e capítulos inclusos. */
export interface NovoCurso {
  titulo: string;
  descricao: string | null;
  cargaHoraria: number | null;
  preco: number | null;
  modulos: NovoModulo[];
}
