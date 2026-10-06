import type { Request, Response } from 'express';
import * as cursoService from '../services/curso.service.ts';
import { ErroApp } from '../utils/erro-app.ts';
import { validarId } from '../utils/validacao.ts';
import { validarCurso } from '../utils/validacao-curso.ts';

/**
 * Traduz o erro em resposta HTTP. Erros previstos (ErroApp) viram o status
 * que a regra de negócio definiu; qualquer outro vira 500, sem expor
 * detalhes internos ao cliente.
 */
function responderErro(resposta: Response, erro: unknown, mensagemPadrao: string): void {
  if (erro instanceof ErroApp) {
    resposta.status(erro.status).json({
      mensagem: erro.message,
      ...(erro.erros ? { erros: erro.erros } : {})
    });
    return;
  }

  console.error(erro);
  resposta.status(500).json({ mensagem: mensagemPadrao });
}

/**
 * O formulário envia os módulos/capítulos como uma string JSON (campo
 * `modulos`), junto dos vídeos no mesmo multipart/form-data — não dá pra
 * mandar um array aninhado direto em form-data.
 */
function extrairModulosBrutos(corpo: Record<string, unknown>): unknown {
  const bruto = corpo['modulos'];

  if (typeof bruto !== 'string') {
    return [];
  }

  try {
    return JSON.parse(bruto);
  } catch {
    return [];
  }
}

/**
 * Monta o mapa `fieldname -> nome do arquivo salvo` a partir dos arquivos que
 * o multer (`.any()`) recebeu — cada capítulo do tipo ARQUIVO manda o vídeo
 * num campo próprio, nomeado `modulo_<indiceModulo>_capitulo_<indiceCapitulo>`.
 */
function extrairArquivosPorChave(requisicao: Request): Map<string, string> {
  const arquivos = Array.isArray(requisicao.files) ? (requisicao.files as Express.Multer.File[]) : [];
  return new Map(arquivos.map((arquivo) => [arquivo.fieldname, arquivo.filename]));
}

/** POST /cursos — cadastra um curso (com módulos e capítulos) para a empresa informada em `idEmpresa`. */
export const cadastrarCurso = async (requisicao: Request, resposta: Response): Promise<void> => {
  try {
    const corpo = requisicao.body as Record<string, unknown>;
    const idEmpresa = validarId(corpo['idEmpresa']);
    const dados = validarCurso({ ...corpo, modulos: extrairModulosBrutos(corpo) });
    const curso = await cursoService.cadastrar(dados, idEmpresa, extrairArquivosPorChave(requisicao));

    resposta.status(201).json(curso);
  } catch (erro) {
    responderErro(resposta, erro, 'Erro ao cadastrar curso');
  }
};

/**
 * GET /cursos — lista os cursos (resumo, sem módulos/capítulos). Com
 * ?idEmpresa=, traz só os daquela empresa (tela de gestão). Com ?status=,
 * filtra pelo status (a busca aberta ao candidato PCD usa ?status=ATIVO,
 * pra não mostrar cursos desativados).
 */
export const listarCursos = async (requisicao: Request, resposta: Response): Promise<void> => {
  try {
    const idEmpresaBruto = requisicao.query['idEmpresa'];
    const idEmpresa = idEmpresaBruto !== undefined ? validarId(idEmpresaBruto) : undefined;
    const status = typeof requisicao.query['status'] === 'string' ? requisicao.query['status'] : undefined;
    const cursos = await cursoService.listar(idEmpresa, status);

    resposta.json(cursos);
  } catch (erro) {
    responderErro(resposta, erro, 'Erro ao buscar cursos');
  }
};

/** GET /cursos/:id — busca um curso com seus módulos e capítulos. */
export const obterCurso = async (requisicao: Request, resposta: Response): Promise<void> => {
  try {
    const id = validarId(requisicao.params['id']);
    const curso = await cursoService.obterDetalhado(id);

    resposta.json(curso);
  } catch (erro) {
    responderErro(resposta, erro, 'Erro ao buscar curso');
  }
};

/** PUT /cursos/:id — atualiza o curso (módulos e capítulos inclusos), só se ele for da empresa informada em `idEmpresa`. */
export const atualizarCurso = async (requisicao: Request, resposta: Response): Promise<void> => {
  try {
    const id = validarId(requisicao.params['id']);
    const corpo = requisicao.body as Record<string, unknown>;
    const idEmpresa = validarId(corpo['idEmpresa']);
    const dados = validarCurso({ ...corpo, modulos: extrairModulosBrutos(corpo) });
    const curso = await cursoService.atualizar(id, dados, idEmpresa, extrairArquivosPorChave(requisicao));

    resposta.json(curso);
  } catch (erro) {
    responderErro(resposta, erro, 'Erro ao atualizar curso');
  }
};
