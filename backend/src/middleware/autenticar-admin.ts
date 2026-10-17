import type { NextFunction, Request, Response } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import pool from '../config/dataBase.ts';
import { verificarToken } from '../utils/token.ts';

/** Membro da equipe autenticado, disponível nos controllers das rotas /admin. */
export interface AdminAutenticado {
  id: number;
  nome: string;
  email: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    admin?: AdminAutenticado;
  }
}

/**
 * Protege as rotas da equipe: exige "Authorization: Bearer <token>" válido
 * e confere no banco que o membro continua ATIVO — desativar alguém na tela
 * Equipe corta o acesso dele na hora, mesmo com um token ainda dentro da validade.
 */
export async function autenticarAdmin(requisicao: Request, resposta: Response, proximo: NextFunction): Promise<void> {
  const cabecalho = requisicao.header('authorization') ?? '';
  const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7) : '';
  const dados = token ? verificarToken(token) : null;
  const id = dados?.sub.startsWith('admin:') ? Number(dados.sub.slice(6)) : NaN;

  if (!Number.isInteger(id)) {
    resposta.status(401).json({ mensagem: 'Sessão expirada. Entre novamente.' });
    return;
  }

  try {
    const [linhas] = await pool.query<RowDataPacket[]>(
      "SELECT IDADMIN, NOME, EMAIL FROM TBLCDSADM0 WHERE IDADMIN = ? AND STATUSADM = 'ATIVO'",
      [id]
    );
    const admin = linhas[0];

    if (!admin) {
      resposta.status(401).json({ mensagem: 'Acesso da equipe desativado ou inexistente.' });
      return;
    }

    requisicao.admin = { id: admin['IDADMIN'] as number, nome: admin['NOME'] as string, email: admin['EMAIL'] as string };
    proximo();
  } catch (erro) {
    proximo(erro);
  }
}
