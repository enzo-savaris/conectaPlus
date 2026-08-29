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

/** Lista as vagas em que o candidato já se candidatou, com o título e o status de cada uma. */
export async function listarCandidaturas(idPcd: number): Promise<RowDataPacket[]> {
  const [linhas] = await pool.query<RowDataPacket[]>(
    `SELECT c.IDCANDIDATURA, c.IDVAGA, c.STATUSCANDIDATURA, c.DTCAD AS DTCANDIDATURA, v.TITULO
     FROM TBLCDSCAND0 c
     INNER JOIN TBLCDSVAG0 v ON v.IDVAGA = c.IDVAGA
     WHERE c.IDPCD = ?
     ORDER BY c.DTCAD DESC`,
    [idPcd]
  );

  return linhas;
}
