import type { Request, Response } from 'express';
import * as usuarioService from '../services/usuario.service.ts';
import { ErroApp } from '../utils/erro-app.ts';
import { validarId } from '../utils/validacao.ts';

/** GET /usuarios — lista os candidatos PCD cadastrados. */
export const listarUsuarios = async (
  _requisicao: Request,
  resposta: Response
): Promise<void> => {
  try {
    const usuarios = await usuarioService.listar();

    resposta.json(usuarios);
  } catch (erro) {
    console.error(erro);

    resposta.status(500).json({
      mensagem: 'Erro ao buscar usuários'
    });
  }
};

/** GET /usuarios/:id/candidaturas — lista as vagas em que o candidato já se candidatou. */
export const listarCandidaturasDoUsuario = async (
  requisicao: Request,
  resposta: Response
): Promise<void> => {
  try {
    const idPcd = validarId(requisicao.params['id']);
    const candidaturas = await usuarioService.listarCandidaturas(idPcd);

    resposta.json(candidaturas);
  } catch (erro) {
    if (erro instanceof ErroApp) {
      resposta.status(erro.status).json({
        mensagem: erro.message,
        ...(erro.erros ? { erros: erro.erros } : {})
      });
      return;
    }

    console.error(erro);
    resposta.status(500).json({ mensagem: 'Erro ao buscar candidaturas do usuário' });
  }
};
