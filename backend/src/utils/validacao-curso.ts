import { erroDeValidacao } from './erro-app.ts';

/**
 * Validação dos dados de um curso. A tela de cadastro já valida os mesmos
 * campos, mas o servidor precisa repetir a checagem: nada impede alguém de
 * chamar a API direto pelo Insomnia, sem passar pelo formulário.
 */

const TIPOS_CONTEUDO = ['LINK', 'ARQUIVO'] as const;

export type TipoConteudoCurso = (typeof TIPOS_CONTEUDO)[number];

/** Curso já validado e pronto para gravar na TBLCDSCURSO0 (menos o arquivo, tratado à parte pelo multer). */
export interface DadosCurso {
  titulo: string;
  descricao: string | null;
  cargaHoraria: number | null;
  preco: number | null;
  tipoConteudo: TipoConteudoCurso;
  linkCurso: string | null;
}

const REGEX_URL = /^https?:\/\/.+/i;

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

function textoOuNulo(valor: unknown): string | null {
  const limpo = texto(valor);
  return limpo === '' ? null : limpo;
}

function validarInteiroPositivo(
  valor: unknown,
  campo: string,
  erros: Record<string, string>
): number | null {
  if (valor === null || valor === undefined || valor === '') {
    return null;
  }

  const numero = Number(valor);

  if (!Number.isInteger(numero) || numero <= 0) {
    erros[campo] = 'Informe um número inteiro positivo.';
    return null;
  }

  return numero;
}

function validarPreco(valor: unknown, erros: Record<string, string>): number | null {
  if (valor === null || valor === undefined || valor === '') {
    return null;
  }

  const numero = Number(valor);

  if (!Number.isFinite(numero) || numero < 0) {
    erros['preco'] = 'Informe um preço válido e não negativo.';
    return null;
  }

  return numero;
}

/**
 * Valida o corpo da requisição e devolve os dados prontos para o banco.
 * Lança ErroApp (422) se algum campo estiver inválido.
 *
 * Não valida a presença do arquivo quando `tipoConteudo` é ARQUIVO: no
 * cadastro isso é conferido pelo service (precisa vir um arquivo novo); na
 * edição, a ausência de um arquivo novo significa "manter o já cadastrado".
 */
export function validarCurso(corpo: unknown): DadosCurso {
  if (typeof corpo !== 'object' || corpo === null) {
    throw erroDeValidacao({ corpo: 'Envie os dados do curso.' });
  }

  const entrada = corpo as Record<string, unknown>;
  const erros: Record<string, string> = {};

  const titulo = texto(entrada['titulo']);
  if (titulo.length < 3) {
    erros['titulo'] = 'O título do curso deve ter ao menos 3 caracteres.';
  } else if (titulo.length > 150) {
    erros['titulo'] = 'O título do curso deve ter no máximo 150 caracteres.';
  }

  const descricao = textoOuNulo(entrada['descricao']);
  const cargaHoraria = validarInteiroPositivo(entrada['cargaHoraria'], 'cargaHoraria', erros);
  const preco = validarPreco(entrada['preco'], erros);

  const tipoConteudo = texto(entrada['tipoConteudo']).toUpperCase();
  if (!(TIPOS_CONTEUDO as readonly string[]).includes(tipoConteudo)) {
    erros['tipoConteudo'] = 'Selecione se o curso terá um link ou um vídeo anexado.';
  }

  let linkCurso: string | null = null;
  if (tipoConteudo === 'LINK') {
    linkCurso = textoOuNulo(entrada['linkCurso']);
    if (linkCurso === null || !REGEX_URL.test(linkCurso)) {
      erros['linkCurso'] = 'Informe um link válido, começando com http:// ou https://.';
    }
  }

  if (Object.keys(erros).length > 0) {
    throw erroDeValidacao(erros);
  }

  return {
    titulo,
    descricao,
    cargaHoraria,
    preco,
    tipoConteudo: tipoConteudo as TipoConteudoCurso,
    linkCurso
  };
}
