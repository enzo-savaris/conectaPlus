import type { Request, Response } from 'express';
import * as empresaService from '../services/empresa.service.ts';
import { ErroApp } from '../utils/erro-app.ts';
import { validarEmpresa, validarId } from '../utils/validacao.ts';

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

/** POST /empresas — cadastra uma empresa. */
export const cadastrarEmpresa = async (
  requisicao: Request,
  resposta: Response
): Promise<void> => {
  try {
    const dados = validarEmpresa(requisicao.body, false);
    const empresa = await empresaService.cadastrar(dados);

    resposta.status(201).json(empresa);
  } catch (erro) {
    responderErro(resposta, erro, 'Erro ao cadastrar empresa');
  }
};

/** GET /empresas — lista as empresas, com busca opcional (?busca=). */
export const listarEmpresas = async (
  requisicao: Request,
  resposta: Response
): Promise<void> => {
  try {
    const busca = typeof requisicao.query['busca'] === 'string' ? requisicao.query['busca'] : undefined;
    const empresas = await empresaService.listar(busca);

    resposta.json(empresas);
  } catch (erro) {
    responderErro(resposta, erro, 'Erro ao buscar empresas');
  }
};

/** GET /empresas/:id — busca uma empresa. */
export const obterEmpresa = async (
  requisicao: Request,
  resposta: Response
): Promise<void> => {
  try {
    const id = validarId(requisicao.params['id']);
    const empresa = await empresaService.obterPorId(id);

    resposta.json(empresa);
  } catch (erro) {
    responderErro(resposta, erro, 'Erro ao buscar empresa');
  }
};

/** PUT /empresas/:id — atualiza os campos enviados. */
export const atualizarEmpresa = async (
  requisicao: Request,
  resposta: Response
): Promise<void> => {
  try {
    const id = validarId(requisicao.params['id']);
    const dados = validarEmpresa(requisicao.body, true);
    const empresa = await empresaService.atualizar(id, dados);

    resposta.json(empresa);
  } catch (erro) {
    responderErro(resposta, erro, 'Erro ao atualizar empresa');
  }
};

/** GET /empresas/:id/painel — resumo (contagens) para os cards do painel inicial da empresa. */
export const obterPainelEmpresa = async (
  requisicao: Request,
  resposta: Response
): Promise<void> => {
  try {
    const id = validarId(requisicao.params['id']);
    const resumo = await empresaService.obterResumoPainel(id);

    resposta.json(resumo);
  } catch (erro) {
    responderErro(resposta, erro, 'Erro ao buscar o resumo do painel');
  }
};

/** DELETE /empresas/:id — remove a empresa. */
export const removerEmpresa = async (
  requisicao: Request,
  resposta: Response
): Promise<void> => {
  try {
    const id = validarId(requisicao.params['id']);
    await empresaService.remover(id);

    resposta.status(204).send();
  } catch (erro) {
    responderErro(resposta, erro, 'Erro ao remover empresa');
  }
};
