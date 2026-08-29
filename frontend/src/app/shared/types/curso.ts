export type TipoConteudoCurso = 'LINK' | 'ARQUIVO';

export type StatusCurso = 'ATIVO' | 'INATIVO';

/** Curso cadastrado por uma empresa, recomendado aos candidatos junto das vagas. */
export interface Curso {
  id: number;
  idEmpresa: number;
  titulo: string;
  descricao: string | null;
  cargaHoraria: number | null;
  preco: number | null;
  tipoConteudo: TipoConteudoCurso;
  /** Só preenchido quando `tipoConteudo` é LINK. */
  linkCurso: string | null;
  /** Só preenchido quando `tipoConteudo` é ARQUIVO: URL completa já pronta pra abrir/baixar. */
  arquivoCursoUrl: string | null;
  dataCadastro: string;
  status: StatusCurso;
}

/**
 * Dados enviados ao cadastrar ou editar um curso. Sempre um dos dois,
 * nunca ambos: um link externo OU um vídeo anexado.
 */
export interface NovoCurso {
  titulo: string;
  descricao: string | null;
  cargaHoraria: number | null;
  preco: number | null;
  tipoConteudo: TipoConteudoCurso;
  linkCurso: string | null;
  /** Novo arquivo a enviar; `null` na edição mantém o arquivo já cadastrado. */
  arquivo: File | null;
}
