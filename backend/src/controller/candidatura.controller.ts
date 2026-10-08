import type { Request, Response } from 'express';
import * as candidaturaService from '../services/candidatura.service.ts';
import { ErroApp } from '../utils/erro-app.ts';
import { validarId } from '../utils/validacao.ts';
import { validarEtapaCandidatura } from '../utils/validacao-etapa-candidatura.ts';

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

/** GET /candidaturas/:id?idEmpresa= — candidatura completa, só se a vaga for da empresa informada. */
export const obterCandidatura = async (requisicao: Request, resposta: Response): Promise<void> => {
  try {
    const id = validarId(requisicao.params['id']);
    const idEmpresa = validarId(requisicao.query['idEmpresa']);
    const candidatura = await candidaturaService.obterParaEmpresa(id, idEmpresa);

    resposta.json(candidatura);
  } catch (erro) {
    responderErro(resposta, erro, 'Erro ao buscar candidatura');
  }
};

/** PUT /candidaturas/:id/etapa — a empresa avança o processo seletivo (análise, entrevista, contratação). */
export const alterarEtapaCandidatura = async (requisicao: Request, resposta: Response): Promise<void> => {
  try {
    const id = validarId(requisicao.params['id']);
    const dados = validarEtapaCandidatura(requisicao.body);
    const candidatura = await candidaturaService.alterarEtapa(id, dados);

    resposta.json(candidatura);
  } catch (erro) {
    responderErro(resposta, erro, 'Erro ao atualizar a etapa da candidatura');
  }
};
