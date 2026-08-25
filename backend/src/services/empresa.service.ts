import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../config/dataBase.ts';
import { erroDeConflito, erroNaoEncontrado } from '../utils/erro-app.ts';
import { gerarHashSenha } from '../utils/senha.ts';
import type { DadosEmpresa, DadosEmpresaParciais } from '../utils/validacao.ts';

const COLUNAS = `IDEMPRESA, RAZAO, FANTASIA, CNPJ, EMAIL, TELEFONE, CEP,
                 NUMERO, COMPLEMENTO, BAIRRO, CIDADE, ESTADO, DTCAD, DTALT, STATUSEMP`;

type ValorSql = string | number | null;

/**
 * Tradução entre os campos da API e as colunas da TBLCDSEMP0. `status` fica
 * de fora de propósito: quem decide o status final na atualização é a regra
 * de revalidação em `atualizar`, não uma atribuição direta genérica.
 */
const COLUNA_POR_CAMPO: Record<string, string> = {
  razaoSocial: 'RAZAO',
  nomeFantasia: 'FANTASIA',
  cnpj: 'CNPJ',
  email: 'EMAIL',
  telefone: 'TELEFONE',
  cep: 'CEP',
  numero: 'NUMERO',
  complemento: 'COMPLEMENTO',
  bairro: 'BAIRRO',
  cidade: 'CIDADE',
  estado: 'ESTADO'
};

async function garantirQueNaoDuplica(
  cnpj: string | undefined,
  email: string | null | undefined,
  idIgnorado?: number
): Promise<void> {
  if (!cnpj && !email) {
    return;
  }

  const condicoes: string[] = [];
  const parametros: ValorSql[] = [];

  if (cnpj) {
    condicoes.push('CNPJ = ?');
    parametros.push(cnpj);
  }

  if (email) {
    condicoes.push('EMAIL = ?');
    parametros.push(email);
  }

  let sql = `SELECT CNPJ, EMAIL FROM TBLCDSEMP0 WHERE (${condicoes.join(' OR ')})`;

  if (idIgnorado !== undefined) {
    sql += ' AND IDEMPRESA <> ?';
    parametros.push(idIgnorado);
  }

  const [linhas] = await pool.query<RowDataPacket[]>(sql, parametros);
  const erros: Record<string, string> = {};

  for (const linha of linhas) {
    if (cnpj && linha['CNPJ'] === cnpj) {
      erros['cnpj'] = 'Já existe uma empresa cadastrada com este CNPJ.';
    }
    if (email && linha['EMAIL'] === email) {
      erros['email'] = 'Já existe uma empresa cadastrada com este e-mail.';
    }
  }

  if (Object.keys(erros).length > 0) {
    throw erroDeConflito('Empresa já cadastrada.', erros);
  }
}

export async function buscarPorId(id: number): Promise<RowDataPacket | null> {
  const [linhas] = await pool.query<RowDataPacket[]>(
    `SELECT ${COLUNAS} FROM TBLCDSEMP0 WHERE IDEMPRESA = ?`,
    [id]
  );

  return linhas[0] ?? null;
}

export async function obterPorId(id: number): Promise<RowDataPacket> {
  const empresa = await buscarPorId(id);

  if (empresa === null) {
    throw erroNaoEncontrado('Empresa não encontrada.');
  }

  return empresa;
}

export async function listar(busca?: string): Promise<RowDataPacket[]> {
  if (busca) {
    const termo = `%${busca}%`;
    const [linhas] = await pool.query<RowDataPacket[]>(
      `SELECT ${COLUNAS} FROM TBLCDSEMP0
       WHERE RAZAO LIKE ? OR FANTASIA LIKE ? OR CNPJ LIKE ?
       ORDER BY RAZAO`,
      [termo, termo, termo]
    );
    return linhas;
  }

  const [linhas] = await pool.query<RowDataPacket[]>(
    `SELECT ${COLUNAS} FROM TBLCDSEMP0 ORDER BY RAZAO`
  );

  return linhas;
}

export async function cadastrar(dados: DadosEmpresa): Promise<RowDataPacket> {
  await garantirQueNaoDuplica(dados.cnpj, dados.email);

  const senhaHash = await gerarHashSenha(dados.senha);

  const [resultado] = await pool.execute<ResultSetHeader>(
    `INSERT INTO TBLCDSEMP0
      (RAZAO, FANTASIA, CNPJ, EMAIL, TELEFONE, CEP, NUMERO,
       COMPLEMENTO, BAIRRO, CIDADE, ESTADO, SENHA, STATUSEMP)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      dados.razaoSocial,
      dados.nomeFantasia,
      dados.cnpj,
      dados.email,
      dados.telefone,
      dados.cep,
      dados.numero,
      dados.complemento,
      dados.bairro,
      dados.cidade,
      dados.estado,
      senhaHash,
      dados.status
    ]
  );

  return obterPorId(resultado.insertId);
}

export async function atualizar(
  id: number,
  dados: DadosEmpresaParciais
): Promise<RowDataPacket> {

  const atual = await obterPorId(id);
  await garantirQueNaoDuplica(dados.cnpj, dados.email, id);

  const atribuicoes: string[] = [];
  const parametros: ValorSql[] = [];

  for (const [campo, coluna] of Object.entries(COLUNA_POR_CAMPO)) {
    const valor = dados[campo as keyof DadosEmpresaParciais];
    if (valor !== undefined) {
      atribuicoes.push(`${coluna} = ?`);
      parametros.push(valor);
    }
  }

  if (dados.senha !== undefined) {
    atribuicoes.push('SENHA = ?');
    parametros.push(await gerarHashSenha(dados.senha));
  }

  // Regra de negócio: alterar CNPJ ou razão social invalida a verificação
  // já feita pelo suporte, então o status volta para PENDENTE — mesmo que o
  // cliente tenha mandado outro status junto na mesma requisição.
  const cnpjMudou = dados.cnpj !== undefined && dados.cnpj !== atual['CNPJ'];
  const razaoSocialMudou = dados.razaoSocial !== undefined && dados.razaoSocial !== atual['RAZAO'];
  const statusFinal = cnpjMudou || razaoSocialMudou ? 'PENDENTE' : dados.status;

  if (statusFinal !== undefined) {
    atribuicoes.push('STATUSEMP = ?');
    parametros.push(statusFinal);
  }

  if (atribuicoes.length === 0) {
    return obterPorId(id);
  }

  parametros.push(id);

  await pool.execute<ResultSetHeader>(
    `UPDATE TBLCDSEMP0 SET ${atribuicoes.join(', ')} WHERE IDEMPRESA = ?`,
    parametros
  );

  return obterPorId(id);
}

/** Resumo do painel inicial da empresa: contagens usadas nos cards de destaque. */
export interface ResumoPainelEmpresa {
  totalVagas: number;
  totalCursos: number;
  totalInscricoes: number;
}

export async function obterResumoPainel(idEmpresa: number): Promise<ResumoPainelEmpresa> {
  await obterPorId(idEmpresa);

  const [[vagas]] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) AS TOTAL FROM TBLCDSVAG0 WHERE IDEMPRESA = ?',
    [idEmpresa]
  );

  const [[cursos]] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) AS TOTAL FROM TBLCDSCURSO0 WHERE IDEMPRESA = ?',
    [idEmpresa]
  );

  const [[inscricoes]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS TOTAL FROM TBLCDSCAND0 c
     INNER JOIN TBLCDSVAG0 v ON v.IDVAGA = c.IDVAGA
     WHERE v.IDEMPRESA = ?`,
    [idEmpresa]
  );

  return {
    totalVagas: Number(vagas?.['TOTAL'] ?? 0),
    totalCursos: Number(cursos?.['TOTAL'] ?? 0),
    totalInscricoes: Number(inscricoes?.['TOTAL'] ?? 0)
  };
}

/** Remove a empresa. Lança 404 se o id não existir. */
export async function remover(id: number): Promise<void> {
  const [resultado] = await pool.execute<ResultSetHeader>(
    'DELETE FROM TBLCDSEMP0 WHERE IDEMPRESA = ?',
    [id]
  );

  if (resultado.affectedRows === 0) {
    throw erroNaoEncontrado('Empresa não encontrada.');
  }
}
