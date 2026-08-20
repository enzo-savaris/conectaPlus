import type { Request, Response } from 'express';
import * as vagaService from '../services/vaga.service.ts';
import { ErroApp } from '../utils/erro-app.ts';
import { validarId } from '../utils/validacao.ts';
import { validarVaga } from '../utils/validacao-vaga.ts';

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

/** POST /vagas — cadastra uma vaga para a empresa informada em `idEmpresa`. */
export const cadastrarVaga = async (requisicao: Request, resposta: Response): Promise<void> => {
  try {
    const corpo = requisicao.body as Record<string, unknown>;
    const idEmpresa = validarId(corpo['idEmpresa']);
    const dados = validarVaga(corpo);
    const vaga = await vagaService.cadastrar(dados, idEmpresa);

    resposta.status(201).json(vaga);
  } catch (erro) {
    responderErro(resposta, erro, 'Erro ao cadastrar vaga');
  }
};

/** GET /vagas — lista as vagas. Com ?idEmpresa=, traz só as daquela empresa. */
export const listarVagas = async (requisicao: Request, resposta: Response): Promise<void> => {
  try {
    const idEmpresaBruto = requisicao.query['idEmpresa'];
    const idEmpresa = idEmpresaBruto !== undefined ? validarId(idEmpresaBruto) : undefined;
    const vagas = await vagaService.listar(idEmpresa);

    resposta.json(vagas);
  } catch (erro) {
    responderErro(resposta, erro, 'Erro ao buscar vagas');
  }
};

/** DELETE /vagas/:id?idEmpresa= — remove a vaga, só se ela for da empresa informada. */
export const removerVaga = async (requisicao: Request, resposta: Response): Promise<void> => {
  try {
    const id = validarId(requisicao.params['id']);
    const idEmpresa = validarId(requisicao.query['idEmpresa']);
    await vagaService.remover(id, idEmpresa);

    resposta.status(204).send();
  } catch (erro) {
    responderErro(resposta, erro, 'Erro ao remover vaga');
  }
};
