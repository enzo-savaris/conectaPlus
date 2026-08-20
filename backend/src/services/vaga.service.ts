import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import pool from '../config/dataBase.ts';
import { erroNaoEncontrado } from '../utils/erro-app.ts';
import type { DadosVaga } from '../utils/validacao-vaga.ts';

const COLUNAS = `IDVAGA, IDEMPRESA, TITULO, AREA, DESCRICAO, CIDADE, ESTADO,
                 MODELOTRABALHO, TIPOCONTRATACAO, SALARIOMIN, SALARIOMAX,
                 DTCAD, STATUSVAGA`;

/** Tabelas filhas que guardam as listas de itens do cadastro, uma linha por item. */
const TABELAS_DE_ITENS = {
  responsabilidades: 'TBLCDSVAGRESP0',
  requisitos: 'TBLCDSVAGREQ0',
  acessibilidade: 'TBLCDSVAGACS0',
  beneficios: 'TBLCDSVAGBEN0'
} as const;

/**
 * Lista as vagas cadastradas, das mais recentes para as mais antigas.
 *
 * Quando `idEmpresa` é informado, traz só as vagas daquela empresa — é o
 * caso da tela de gestão de vagas, que não deve mostrar vagas de outras
 * empresas. Sem o filtro, lista todas (uso futuro: busca aberta ao candidato).
 */
export async function listar(idEmpresa?: number): Promise<RowDataPacket[]> {
  if (idEmpresa !== undefined) {
    const [linhas] = await pool.query<RowDataPacket[]>(
      `SELECT ${COLUNAS} FROM TBLCDSVAG0 WHERE IDEMPRESA = ? ORDER BY DTCAD DESC`,
      [idEmpresa]
    );
    return linhas;
  }

  const [linhas] = await pool.query<RowDataPacket[]>(
    `SELECT ${COLUNAS} FROM TBLCDSVAG0 ORDER BY DTCAD DESC`
  );

  return linhas;
}

export async function buscarPorId(id: number): Promise<RowDataPacket | null> {
  const [linhas] = await pool.query<RowDataPacket[]>(
    `SELECT ${COLUNAS} FROM TBLCDSVAG0 WHERE IDVAGA = ?`,
    [id]
  );

  return linhas[0] ?? null;
}

export async function obterPorId(id: number): Promise<RowDataPacket> {
  const vaga = await buscarPorId(id);

  if (vaga === null) {
    throw erroNaoEncontrado('Vaga não encontrada.');
  }

  return vaga;
}

async function inserirItens(
  conexao: PoolConnection,
  tabela: string,
  idVaga: number,
  itens: string[]
): Promise<void> {
  if (itens.length === 0) {
    return;
  }

  const valores = itens.map((item) => [idVaga, item]);
  await conexao.query(`INSERT INTO ${tabela} (IDVAGA, DESCRICAO) VALUES ?`, [valores]);
}

export async function cadastrar(dados: DadosVaga, idEmpresa: number): Promise<RowDataPacket> {
  const conexao = await pool.getConnection();

  try {
    await conexao.beginTransaction();

    const [resultado] = await conexao.execute<ResultSetHeader>(
      `INSERT INTO TBLCDSVAG0
        (IDEMPRESA, TITULO, AREA, DESCRICAO, CIDADE, ESTADO,
         MODELOTRABALHO, TIPOCONTRATACAO, SALARIOMIN, SALARIOMAX)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        idEmpresa,
        dados.titulo,
        dados.area,
        dados.descricao,
        dados.cidade,
        dados.estado,
        dados.modeloTrabalho,
        dados.tipoContratacao,
        dados.salarioMinimo,
        dados.salarioMaximo
      ]
    );

    const idVaga = resultado.insertId;

    await inserirItens(conexao, TABELAS_DE_ITENS.responsabilidades, idVaga, dados.responsabilidades);
    await inserirItens(conexao, TABELAS_DE_ITENS.requisitos, idVaga, dados.requisitos);
    await inserirItens(conexao, TABELAS_DE_ITENS.acessibilidade, idVaga, dados.acessibilidade);
    await inserirItens(conexao, TABELAS_DE_ITENS.beneficios, idVaga, dados.beneficios);

    await conexao.commit();

    return await obterPorId(idVaga);
  } catch (erro) {
    await conexao.rollback();
    throw erro;
  } finally {
    conexao.release();
  }
}

/**
 * Remove a vaga, só se ela pertencer à empresa informada. Lança 404 tanto se
 * o id não existir quanto se a vaga for de outra empresa — não dá pra saber
 * qual dos dois casos é, pra não revelar dados de vagas de outra empresa.
 */
export async function remover(id: number, idEmpresa: number): Promise<void> {
  const [resultado] = await pool.execute<ResultSetHeader>(
    'DELETE FROM TBLCDSVAG0 WHERE IDVAGA = ? AND IDEMPRESA = ?',
    [id, idEmpresa]
  );

  if (resultado.affectedRows === 0) {
    throw erroNaoEncontrado('Vaga não encontrada.');
  }
}
