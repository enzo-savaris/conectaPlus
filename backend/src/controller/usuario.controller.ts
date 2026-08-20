import type { Request, Response } from 'express';
import * as usuarioService from '../services/usuario.service.ts';

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
