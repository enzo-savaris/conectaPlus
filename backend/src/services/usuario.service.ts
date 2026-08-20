import type { RowDataPacket } from 'mysql2';
import pool from '../config/dataBase.ts';

/**
 * Camada de acesso ao banco dos candidatos PCD (tabela TBLCDSUSR0).
 */

/**
 * As colunas são listadas uma a uma de propósito: com SELECT * a coluna
 * SENHA iria junto na resposta da API.
 */
const COLUNAS = `IDPCD, NOME, EMAIL, TELEFONE, CPF, SOBREMIM, TIPODEF,
                 CIDADE, ESTADO, DTCAD, STATUSPCD`;

/** Lista os usuários cadastrados, em ordem alfabética. */
export async function listar(): Promise<RowDataPacket[]> {
  const [usuarios] = await pool.query<RowDataPacket[]>(
    `SELECT ${COLUNAS} FROM TBLCDSUSR0 ORDER BY NOME`
  );

  return usuarios;
}
