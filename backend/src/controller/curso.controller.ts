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

/** POST /cursos — cadastra um curso para a empresa informada em `idEmpresa`. */
export const cadastrarCurso = async (requisicao: Request, resposta: Response): Promise<void> => {
  try {
    const corpo = requisicao.body as Record<string, unknown>;
    const idEmpresa = validarId(corpo['idEmpresa']);
    const dados = validarCurso(corpo);
    const curso = await cursoService.cadastrar(dados, idEmpresa, requisicao.file?.filename ?? null);

    resposta.status(201).json(curso);
  } catch (erro) {
    responderErro(resposta, erro, 'Erro ao cadastrar curso');
  }
};

/** GET /cursos — lista os cursos. Com ?idEmpresa=, traz só os daquela empresa. */
export const listarCursos = async (requisicao: Request, resposta: Response): Promise<void> => {
  try {
    const idEmpresaBruto = requisicao.query['idEmpresa'];
    const idEmpresa = idEmpresaBruto !== undefined ? validarId(idEmpresaBruto) : undefined;
    const cursos = await cursoService.listar(idEmpresa);

    resposta.json(cursos);
  } catch (erro) {
    responderErro(resposta, erro, 'Erro ao buscar cursos');
  }
};

/** GET /cursos/:id — busca um curso. */
export const obterCurso = async (requisicao: Request, resposta: Response): Promise<void> => {
  try {
    const id = validarId(requisicao.params['id']);
    const curso = await cursoService.obterPorId(id);

    resposta.json(curso);
  } catch (erro) {
    responderErro(resposta, erro, 'Erro ao buscar curso');
  }
};

/** PUT /cursos/:id — atualiza o curso, só se ele for da empresa informada em `idEmpresa`. */
export const atualizarCurso = async (requisicao: Request, resposta: Response): Promise<void> => {
  try {
    const id = validarId(requisicao.params['id']);
    const corpo = requisicao.body as Record<string, unknown>;
    const idEmpresa = validarId(corpo['idEmpresa']);
    const dados = validarCurso(corpo);
    const curso = await cursoService.atualizar(id, dados, idEmpresa, requisicao.file?.filename ?? null);

    resposta.json(curso);
  } catch (erro) {
    responderErro(resposta, erro, 'Erro ao atualizar curso');
  }
};
