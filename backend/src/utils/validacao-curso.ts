import { erroDeValidacao } from './erro-app.ts';

/**
 * Validação dos dados de um curso. A tela de cadastro já valida os mesmos
 * campos, mas o servidor precisa repetir a checagem: nada impede alguém de
 * chamar a API direto pelo Insomnia, sem passar pelo formulário.
 */

const TIPOS_CONTEUDO = ['LINK', 'ARQUIVO'] as const;

export type TipoConteudoCurso = (typeof TIPOS_CONTEUDO)[number];

/**
 * Um capítulo (aula) já validado. `arquivoNovo` vem do multer (campo
 * `capitulo_<indiceModulo>_<indiceCapitulo>`, casado pelo controller);
 * `arquivoAtual` é o nome do arquivo já cadastrado, reenviado pela tela de
 * edição quando o capítulo mantém o vídeo que já tinha.
 */
export interface DadosCapitulo {
  titulo: string;
  tipoConteudo: TipoConteudoCurso;
  linkCapitulo: string | null;
  arquivoAtual: string | null;
}

export interface DadosModulo {
  titulo: string;
  capitulos: DadosCapitulo[];
}

/** Curso já validado e pronto para gravar (módulos e capítulos inclusos). */
export interface DadosCurso {
  titulo: string;
  descricao: string | null;
  cargaHoraria: number | null;
  preco: number | null;
  modulos: DadosModulo[];
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

function validarCapitulo(
  entrada: unknown,
  caminho: string,
  erros: Record<string, string>
): DadosCapitulo {
  const objeto = typeof entrada === 'object' && entrada !== null ? (entrada as Record<string, unknown>) : {};

  const titulo = texto(objeto['titulo']);
  if (titulo.length < 3) {
    erros[`${caminho}.titulo`] = 'O título da aula deve ter ao menos 3 caracteres.';
  }

  const tipoConteudo = texto(objeto['tipoConteudo']).toUpperCase();
  if (!(TIPOS_CONTEUDO as readonly string[]).includes(tipoConteudo)) {
    erros[`${caminho}.tipoConteudo`] = 'Selecione se a aula terá um link ou um vídeo anexado.';
  }

  let linkCapitulo: string | null = null;
  if (tipoConteudo === 'LINK') {
    linkCapitulo = textoOuNulo(objeto['linkCapitulo']);
    if (linkCapitulo === null || !REGEX_URL.test(linkCapitulo)) {
      erros[`${caminho}.linkCapitulo`] = 'Informe um link válido, começando com http:// ou https://.';
    }
  }

  return {
    titulo,
    tipoConteudo: tipoConteudo as TipoConteudoCurso,
    linkCapitulo,
    arquivoAtual: textoOuNulo(objeto['arquivoAtual'])
  };
}

function validarModulo(entrada: unknown, indice: number, erros: Record<string, string>): DadosModulo {
  const objeto = typeof entrada === 'object' && entrada !== null ? (entrada as Record<string, unknown>) : {};
  const caminhoModulo = `modulos[${indice}]`;

  const titulo = texto(objeto['titulo']);
  if (titulo.length < 3) {
    erros[`${caminhoModulo}.titulo`] = 'O título do módulo deve ter ao menos 3 caracteres.';
  }

  const capitulosBrutos = Array.isArray(objeto['capitulos']) ? objeto['capitulos'] : [];
  if (capitulosBrutos.length === 0) {
    erros[`${caminhoModulo}.capitulos`] = 'Cadastre ao menos uma aula neste módulo.';
  }

  const capitulos = capitulosBrutos.map((capitulo, indiceCapitulo) =>
    validarCapitulo(capitulo, `${caminhoModulo}.capitulos[${indiceCapitulo}]`, erros)
  );

  return { titulo, capitulos };
}

/**
 * Valida o corpo da requisição e devolve os dados prontos para o banco.
 * Lança ErroApp (422) se algum campo estiver inválido.
 *
 * `corpo.modulos` chega como string JSON (vem de um campo de formulário
 * multipart, junto dos arquivos de vídeo) — o controller já faz o
 * `JSON.parse` antes de chamar esta função.
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

  const modulosBrutos = Array.isArray(entrada['modulos']) ? entrada['modulos'] : [];
  if (modulosBrutos.length === 0) {
    erros['modulos'] = 'Cadastre ao menos um módulo.';
  }

  const modulos = modulosBrutos.map((modulo, indice) => validarModulo(modulo, indice, erros));

  if (Object.keys(erros).length > 0) {
    throw erroDeValidacao(erros);
  }

  return { titulo, descricao, cargaHoraria, preco, modulos };
}
