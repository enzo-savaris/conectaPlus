import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import pool from '../config/dataBase.ts';
import { erroDeValidacao, erroNaoEncontrado } from '../utils/erro-app.ts';

const COLUNAS = 'IDCIDADE, NOME, ESTADO';

/** Lista/busca cidades já cadastradas, usadas no combobox do cadastro de vaga. */
export async function buscar(termo?: string): Promise<RowDataPacket[]> {
  if (termo) {
    const [linhas] = await pool.query<RowDataPacket[]>(
      `SELECT ${COLUNAS} FROM TBLCDSCID0 WHERE NOME LIKE ? ORDER BY NOME LIMIT 20`,
      [`%${termo}%`]
    );
    return linhas;
  }

  const [linhas] = await pool.query<RowDataPacket[]>(`SELECT ${COLUNAS} FROM TBLCDSCID0 ORDER BY NOME LIMIT 20`);
  return linhas;
}

export async function obterPorId(id: number): Promise<RowDataPacket> {
  const [linhas] = await pool.query<RowDataPacket[]>(`SELECT ${COLUNAS} FROM TBLCDSCID0 WHERE IDCIDADE = ?`, [id]);

  if (!linhas[0]) {
    throw erroNaoEncontrado('Cidade não encontrada.');
  }

  return linhas[0];
}

/**
 * Confere que o id de cidade escolhido no combobox realmente existe, antes
 * de gravar na vaga — devolve um 422 amigável em vez do erro cru de
 * violação de chave estrangeira do MySQL.
 */
export async function confirmarExiste(executor: Pool | PoolConnection, id: number): Promise<void> {
  const [linhas] = await executor.query<RowDataPacket[]>('SELECT IDCIDADE FROM TBLCDSCID0 WHERE IDCIDADE = ?', [id]);

  if (!linhas[0]) {
    throw erroDeValidacao({ idCidade: 'Cidade inválida. Busque e selecione uma cidade da lista.' });
  }
}

/**
 * Resolve o id de uma cidade a partir do nome + UF, criando a linha em
 * TBLCDSCID0 na primeira vez que aquela combinação aparece (ex: quando vem
 * de uma busca por CEP). Da segunda vez em diante, reaproveita o mesmo id.
 */
export async function resolverOuCriar(
  executor: Pool | PoolConnection,
  nome: string,
  estado: string
): Promise<RowDataPacket> {
  const [existentes] = await executor.query<RowDataPacket[]>(
    `SELECT ${COLUNAS} FROM TBLCDSCID0 WHERE NOME = ? AND ESTADO = ?`,
    [nome, estado]
  );

  if (existentes[0]) {
    return existentes[0];
  }

  const [resultado] = await executor.execute<ResultSetHeader>(
    'INSERT INTO TBLCDSCID0 (NOME, ESTADO) VALUES (?, ?)',
    [nome, estado]
  );

  return obterPorId(resultado.insertId);
}

/** Resposta da API pública ViaCEP (https://viacep.com.br). */
interface RespostaViaCep {
  localidade?: string;
  uf?: string;
  erro?: boolean;
}

/**
 * Busca o endereço do CEP na ViaCEP (serviço público, sem chave de API) e
 * resolve/cria a cidade correspondente em TBLCDSCID0.
 */
export async function buscarPorCep(cep: string): Promise<RowDataPacket> {
  let resposta: Response;

  try {
    resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
  } catch {
    throw erroDeValidacao({ cep: 'Não foi possível consultar o CEP agora. Tente novamente.' });
  }

  if (!resposta.ok) {
    throw erroDeValidacao({ cep: 'Não foi possível consultar o CEP agora. Tente novamente.' });
  }

  const dados = (await resposta.json()) as RespostaViaCep;

  if (dados.erro || !dados.localidade || !dados.uf) {
    throw erroNaoEncontrado('CEP não encontrado.');
  }

  return resolverOuCriar(pool, dados.localidade, dados.uf);
}
