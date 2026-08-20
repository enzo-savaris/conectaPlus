import type { Request, Response } from 'express';
import * as authService from '../services/auth.service.ts';
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

/** POST /auth/login — autentica por CPF (candidato) ou CNPJ (empresa). */
export const login = async (requisicao: Request, resposta: Response): Promise<void> => {
  try {
    const corpo = requisicao.body as Record<string, unknown>;
    const documento = apenasDigitos(
      typeof corpo['documento'] === 'string' ? corpo['documento'] : ''
    );
    const senha = typeof corpo['senha'] === 'string' ? corpo['senha'] : '';

    if (!documento || !senha) {
      resposta.status(422).json({ mensagem: 'Informe o CPF/CNPJ e a senha.' });
      return;
    }

    const sessao = await authService.autenticar(documento, senha);
    resposta.json(sessao);
  } catch (erro) {
    responderErro(resposta, erro, 'Erro ao autenticar');
  }
};
