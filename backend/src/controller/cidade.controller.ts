import type { Request, Response } from 'express';
import * as cidadeService from '../services/cidade.service.ts';
import { ErroApp } from '../utils/erro-app.ts';
import { apenasDigitos } from '../utils/validacao.ts';

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

/** GET /cidades?busca= — lista/busca cidades já cadastradas, para o combobox do cadastro de vaga. */
export const listarCidades = async (requisicao: Request, resposta: Response): Promise<void> => {
  try {
    const busca = typeof requisicao.query['busca'] === 'string' ? requisicao.query['busca'] : undefined;
    const cidades = await cidadeService.buscar(busca);

    resposta.json(cidades);
  } catch (erro) {
    responderErro(resposta, erro, 'Erro ao buscar cidades');
  }
};

/** GET /cidades/cep/:cep — resolve a cidade do CEP informado, criando-a se ainda não existir. */
export const buscarCidadePorCep = async (requisicao: Request, resposta: Response): Promise<void> => {
  try {
    const cep = apenasDigitos(String(requisicao.params['cep'] ?? ''));

    if (cep.length !== 8) {
      resposta.status(422).json({ mensagem: 'O CEP deve ter 8 dígitos.', erros: { cep: 'O CEP deve ter 8 dígitos.' } });
      return;
    }

    const cidade = await cidadeService.buscarPorCep(cep);

    resposta.json(cidade);
  } catch (erro) {
    responderErro(resposta, erro, 'Erro ao buscar cidade pelo CEP');
  }
};
