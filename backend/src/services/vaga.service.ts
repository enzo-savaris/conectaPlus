import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import pool from '../config/dataBase.ts';
import * as cidadeService from './cidade.service.ts';
import { garantirEmpresaAtiva } from './empresa.service.ts';
import { erroDeConflito, erroNaoEncontrado } from '../utils/erro-app.ts';
import type { DadosCandidatura } from '../utils/validacao-candidatura.ts';
import type { DadosVaga } from '../utils/validacao-vaga.ts';

/**
 * A vaga guarda só o IDCIDADE e o IDEMPRESA; aqui juntamos com TBLCDSCID0 e
 * TBLCDSEMP0 pra devolver também o nome/UF (CIDADE, ESTADO) e o nome da
 * empresa (NOMEEMPRESA) já prontos, no mesmo formato que a API sempre
 * devolveu, sem precisar mexer em quem consome esse retorno.
 */
const COLUNAS = `v.IDVAGA, v.IDEMPRESA, v.TITULO, v.AREA, v.DESCRICAO, v.IDCIDADE,
                 ci.NOME AS CIDADE, ci.ESTADO AS ESTADO,
                 COALESCE(emp.FANTASIA, emp.RAZAO) AS NOMEEMPRESA,
                 v.MODELOTRABALHO, v.TIPOCONTRATACAO, v.SALARIOMIN, v.SALARIOMAX,
                 v.DTCAD, v.STATUSVAGA`;
const TABELA_COM_CIDADE = `TBLCDSVAG0 v
  LEFT JOIN TBLCDSCID0 ci ON ci.IDCIDADE = v.IDCIDADE
  LEFT JOIN TBLCDSEMP0 emp ON emp.IDEMPRESA = v.IDEMPRESA`;

/** Tabelas filhas que guardam as listas de itens do cadastro, uma linha por item. */
const TABELAS_DE_ITENS = {
  responsabilidades: { tabela: 'TBLCDSVAGRESP0', coluna: 'IDRESP' },
  requisitos: { tabela: 'TBLCDSVAGREQ0', coluna: 'IDREQ' },
  acessibilidade: { tabela: 'TBLCDSVAGACS0', coluna: 'IDACS' },
  beneficios: { tabela: 'TBLCDSVAGBEN0', coluna: 'IDBEN' },
  perguntas: { tabela: 'TBLCDSVAGPERG0', coluna: 'IDPERG' }
} as const;

type ChaveDeItens = keyof typeof TABELAS_DE_ITENS;

/**
 * Lista as vagas cadastradas, das mais recentes para as mais antigas.
 *
 * Quando `idEmpresa` é informado, traz só as vagas daquela empresa — é o
 * caso da tela de gestão de vagas, que não deve mostrar vagas de outras
 * empresas. `status` é usado pela busca aberta ao candidato PCD, que só deve
 * ver vagas ATIVA (nunca as encerradas ou inativas de outra empresa).
 */
export async function listar(idEmpresa?: number, status?: string): Promise<RowDataPacket[]> {
  const condicoes: string[] = [];
  const parametros: (number | string)[] = [];

  if (idEmpresa !== undefined) {
    condicoes.push('v.IDEMPRESA = ?');
    parametros.push(idEmpresa);
  }

  if (status !== undefined) {
    condicoes.push('v.STATUSVAGA = ?');
    parametros.push(status);
  }

  const filtro = condicoes.length > 0 ? `WHERE ${condicoes.join(' AND ')}` : '';

  const [linhas] = await pool.query<RowDataPacket[]>(
    `SELECT ${COLUNAS} FROM ${TABELA_COM_CIDADE} ${filtro} ORDER BY v.DTCAD DESC`,
    parametros
  );

  return linhas;
}

export async function buscarPorId(id: number): Promise<RowDataPacket | null> {
  const [linhas] = await pool.query<RowDataPacket[]>(
    `SELECT ${COLUNAS} FROM ${TABELA_COM_CIDADE} WHERE v.IDVAGA = ?`,
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
  chave: ChaveDeItens,
  idVaga: number,
  itens: string[]
): Promise<void> {
  if (itens.length === 0) {
    return;
  }

  const { tabela } = TABELAS_DE_ITENS[chave];
  const valores = itens.map((item) => [idVaga, item]);
  await conexao.query(`INSERT INTO ${tabela} (IDVAGA, DESCRICAO) VALUES ?`, [valores]);
}

/** Remove todos os itens de uma lista da vaga, para serem regravados na edição. */
async function removerItens(conexao: PoolConnection, chave: ChaveDeItens, idVaga: number): Promise<void> {
  const { tabela } = TABELAS_DE_ITENS[chave];
  await conexao.query(`DELETE FROM ${tabela} WHERE IDVAGA = ?`, [idVaga]);
}

/** Lista os itens de uma vaga, na ordem em que foram cadastrados. */
async function listarItens(chave: ChaveDeItens, idVaga: number): Promise<string[]> {
  const { tabela, coluna } = TABELAS_DE_ITENS[chave];
  const [linhas] = await pool.query<RowDataPacket[]>(
    `SELECT DESCRICAO FROM ${tabela} WHERE IDVAGA = ? ORDER BY ${coluna}`,
    [idVaga]
  );

  return linhas.map((linha) => linha['DESCRICAO'] as string);
}

/**
 * Cursos que a empresa recomenda para a vaga, com os dados usados no card da
 * página da vaga. O conteúdo em si (módulos/capítulos) fica na própria tela
 * do curso — o card só linka pra lá, não abre um vídeo direto.
 */
async function listarCursosRecomendados(idVaga: number): Promise<RowDataPacket[]> {
  const [linhas] = await pool.query<RowDataPacket[]>(
    `SELECT c.IDCURSO, c.TITULO, c.CARGAHORARIA, c.PRECO
     FROM TBLCDSVAGCURSO0 vc
     INNER JOIN TBLCDSCURSO0 c ON c.IDCURSO = vc.IDCURSO
     WHERE vc.IDVAGA = ?
     ORDER BY c.TITULO`,
    [idVaga]
  );

  return linhas;
}

/**
 * Regrava a lista de cursos recomendados da vaga. Só aceita ids de cursos da
 * própria empresa — do contrário, uma empresa poderia recomendar o curso de
 * outra só adivinhando o id.
 */
async function definirCursosRecomendados(
  conexao: PoolConnection,
  idVaga: number,
  idEmpresa: number,
  idsCursos: number[]
): Promise<void> {
  await conexao.query('DELETE FROM TBLCDSVAGCURSO0 WHERE IDVAGA = ?', [idVaga]);

  if (idsCursos.length === 0) {
    return;
  }

  const [linhas] = await conexao.query<RowDataPacket[]>(
    `SELECT IDCURSO FROM TBLCDSCURSO0 WHERE IDEMPRESA = ? AND IDCURSO IN (${idsCursos.map(() => '?').join(',')})`,
    [idEmpresa, ...idsCursos]
  );

  const idsValidos = linhas.map((linha) => linha['IDCURSO'] as number);
  if (idsValidos.length === 0) {
    return;
  }

  const valores = idsValidos.map((idCurso) => [idVaga, idCurso]);
  await conexao.query('INSERT INTO TBLCDSVAGCURSO0 (IDVAGA, IDCURSO) VALUES ?', [valores]);
}

/** Vaga com as listas de itens do cadastro, usada para preencher a tela de edição. */
export async function obterDetalhado(id: number): Promise<Record<string, unknown>> {
  const vaga = await obterPorId(id);

  const [responsabilidades, requisitos, acessibilidade, beneficios, perguntas, cursosRecomendados] =
    await Promise.all([
      listarItens('responsabilidades', id),
      listarItens('requisitos', id),
      listarItens('acessibilidade', id),
      listarItens('beneficios', id),
      listarItens('perguntas', id),
      listarCursosRecomendados(id)
    ]);

  return { ...vaga, responsabilidades, requisitos, acessibilidade, beneficios, perguntas, cursosRecomendados };
}

export async function cadastrar(dados: DadosVaga, idEmpresa: number): Promise<RowDataPacket> {
  await garantirEmpresaAtiva(idEmpresa);

  const conexao = await pool.getConnection();

  try {
    await conexao.beginTransaction();

    if (dados.idCidade !== null) {
      await cidadeService.confirmarExiste(conexao, dados.idCidade);
    }

    const [resultado] = await conexao.execute<ResultSetHeader>(
      `INSERT INTO TBLCDSVAG0
        (IDEMPRESA, TITULO, AREA, DESCRICAO, IDCIDADE,
         MODELOTRABALHO, TIPOCONTRATACAO, SALARIOMIN, SALARIOMAX)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        idEmpresa,
        dados.titulo,
        dados.area,
        dados.descricao,
        dados.idCidade,
        dados.modeloTrabalho,
        dados.tipoContratacao,
        dados.salarioMinimo,
        dados.salarioMaximo
      ]
    );

    const idVaga = resultado.insertId;

    await inserirItens(conexao, 'responsabilidades', idVaga, dados.responsabilidades);
    await inserirItens(conexao, 'requisitos', idVaga, dados.requisitos);
    await inserirItens(conexao, 'acessibilidade', idVaga, dados.acessibilidade);
    await inserirItens(conexao, 'beneficios', idVaga, dados.beneficios);
    await inserirItens(conexao, 'perguntas', idVaga, dados.perguntas);
    await definirCursosRecomendados(conexao, idVaga, idEmpresa, dados.cursosRecomendados);

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
 * Atualiza a vaga, só se ela pertencer à empresa informada. Lança 404 tanto se
 * o id não existir quanto se a vaga for de outra empresa — mesmo critério do
 * `remover`, pra não revelar dados de vagas de outra empresa.
 *
 * Verifica a posse com um SELECT antes do UPDATE em vez de olhar o
 * `affectedRows` do próprio UPDATE: sem a flag `FOUND_ROWS` do MySQL, uma
 * atualização que não muda nenhum valor (reenviar a vaga sem editar nada)
 * também devolve `affectedRows = 0`, o que geraria um 404 incorreto.
 */
export async function atualizar(
  id: number,
  dados: DadosVaga,
  idEmpresa: number
): Promise<RowDataPacket> {
  await garantirEmpresaAtiva(idEmpresa);

  const conexao = await pool.getConnection();

  try {
    await conexao.beginTransaction();

    const [linhas] = await conexao.query<RowDataPacket[]>(
      'SELECT IDVAGA FROM TBLCDSVAG0 WHERE IDVAGA = ? AND IDEMPRESA = ? FOR UPDATE',
      [id, idEmpresa]
    );

    if (linhas.length === 0) {
      throw erroNaoEncontrado('Vaga não encontrada.');
    }

    if (dados.idCidade !== null) {
      await cidadeService.confirmarExiste(conexao, dados.idCidade);
    }

    await conexao.execute(
      `UPDATE TBLCDSVAG0 SET
        TITULO = ?, AREA = ?, DESCRICAO = ?, IDCIDADE = ?,
        MODELOTRABALHO = ?, TIPOCONTRATACAO = ?, SALARIOMIN = ?, SALARIOMAX = ?
       WHERE IDVAGA = ?`,
      [
        dados.titulo,
        dados.area,
        dados.descricao,
        dados.idCidade,
        dados.modeloTrabalho,
        dados.tipoContratacao,
        dados.salarioMinimo,
        dados.salarioMaximo,
        id
      ]
    );

    await removerItens(conexao, 'responsabilidades', id);
    await removerItens(conexao, 'requisitos', id);
    await removerItens(conexao, 'acessibilidade', id);
    await removerItens(conexao, 'beneficios', id);
    await removerItens(conexao, 'perguntas', id);

    await inserirItens(conexao, 'responsabilidades', id, dados.responsabilidades);
    await inserirItens(conexao, 'requisitos', id, dados.requisitos);
    await inserirItens(conexao, 'acessibilidade', id, dados.acessibilidade);
    await inserirItens(conexao, 'beneficios', id, dados.beneficios);
    await inserirItens(conexao, 'perguntas', id, dados.perguntas);
    await definirCursosRecomendados(conexao, id, idEmpresa, dados.cursosRecomendados);

    await conexao.commit();

    return await obterPorId(id);
  } catch (erro) {
    await conexao.rollback();
    throw erro;
  } finally {
    conexao.release();
  }
}

/**
 * Lista os inscritos de uma vaga, só se ela pertencer à empresa informada.
 * Lança 404 tanto se o id não existir quanto se a vaga for de outra empresa —
 * os dados dos candidatos são mais sensíveis que a própria vaga, então nem a
 * lista vazia deve vazar pra quem não é dono dela.
 */
export async function listarCandidaturas(
  idVaga: number,
  idEmpresa: number
): Promise<RowDataPacket[]> {
  const vaga = await buscarPorId(idVaga);

  if (vaga === null || vaga['IDEMPRESA'] !== idEmpresa) {
    throw erroNaoEncontrado('Vaga não encontrada.');
  }

  const [linhas] = await pool.query<RowDataPacket[]>(
    `SELECT c.IDCANDIDATURA, c.STATUSCANDIDATURA, c.DTCAD AS DTCANDIDATURA,
            c.CARTAAPRESENTACAO, c.ENTREVISTAREMOTA, c.TEMPOESTENDIDO,
            c.INTERPRETELIBRAS, c.INICIOIMEDIATO,
            COALESCE(c.CURRICULOPDF, u.CURRICULOPDF) AS CURRICULOPDF,
            u.IDPCD, u.NOME, u.EMAIL, u.SOBREMIM
     FROM TBLCDSCAND0 c
     INNER JOIN TBLCDSUSR0 u ON u.IDPCD = c.IDPCD
     WHERE c.IDVAGA = ?
     ORDER BY c.DTCAD DESC`,
    [idVaga]
  );

  const respostas = await listarRespostas(linhas.map((linha) => linha['IDCANDIDATURA'] as number));

  return linhas.map((linha) => ({
    ...linha,
    respostas: respostas.get(linha['IDCANDIDATURA'] as number) ?? []
  })) as RowDataPacket[];
}

/**
 * Candidata o PCD à vaga, com a carta de apresentação, as adaptações de
 * acessibilidade pedidas para o processo e as respostas às perguntas da
 * empresa. Só aceita vagas ATIVA (não dá pra se candidatar a uma vaga
 * encerrada ou inativa) e bloqueia uma segunda candidatura à mesma vaga — a
 * unicidade também é garantida no banco (UQ_CANDIDATURA), mas o check aqui
 * devolve uma mensagem amigável em vez do erro cru do MySQL.
 *
 * `curriculoPdf` é o nome do arquivo já salvo pelo multer quando o candidato
 * anexou um PDF só para esta vaga; `null` usa o currículo do perfil.
 */
export async function candidatar(
  idVaga: number,
  dados: DadosCandidatura,
  curriculoPdf: string | null
): Promise<RowDataPacket> {
  const vaga = await buscarPorId(idVaga);

  if (vaga === null || vaga['STATUSVAGA'] !== 'ATIVA') {
    throw erroNaoEncontrado('Vaga não encontrada.');
  }

  const conexao = await pool.getConnection();

  try {
    await conexao.beginTransaction();

    const [existentes] = await conexao.query<RowDataPacket[]>(
      'SELECT IDCANDIDATURA FROM TBLCDSCAND0 WHERE IDVAGA = ? AND IDPCD = ?',
      [idVaga, dados.idPcd]
    );

    if (existentes.length > 0) {
      throw erroDeConflito('Você já se candidatou a esta vaga.');
    }

    const [resultado] = await conexao.execute<ResultSetHeader>(
      `INSERT INTO TBLCDSCAND0
        (IDVAGA, IDPCD, CARTAAPRESENTACAO, CURRICULOPDF,
         ENTREVISTAREMOTA, TEMPOESTENDIDO, INTERPRETELIBRAS, INICIOIMEDIATO)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        idVaga,
        dados.idPcd,
        dados.cartaApresentacao,
        curriculoPdf,
        dados.entrevistaRemota,
        dados.tempoEstendido,
        dados.interpreteLibras,
        dados.inicioImediato
      ]
    );

    const idCandidatura = resultado.insertId;

    // Primeira linha do histórico do processo seletivo ("Candidatura recebida").
    await conexao.execute('INSERT INTO TBLCDSCANDHIST0 (IDCANDIDATURA, STATUSCANDIDATURA) VALUES (?, ?)', [
      idCandidatura,
      'PENDENTE'
    ]);

    if (dados.respostas.length > 0) {
      const valores = dados.respostas.map((item) => [idCandidatura, item.pergunta, item.resposta]);
      await conexao.query('INSERT INTO TBLCDSCANDRESP0 (IDCANDIDATURA, PERGUNTA, RESPOSTA) VALUES ?', [valores]);
    }

    await conexao.commit();

    const [linhas] = await pool.query<RowDataPacket[]>(
      'SELECT IDCANDIDATURA, IDVAGA, IDPCD, STATUSCANDIDATURA, DTCAD FROM TBLCDSCAND0 WHERE IDCANDIDATURA = ?',
      [idCandidatura]
    );

    return linhas[0]!;
  } catch (erro) {
    await conexao.rollback();
    throw erro;
  } finally {
    conexao.release();
  }
}

/** Respostas às perguntas da vaga, agrupadas por candidatura. */
export async function listarRespostas(idsCandidaturas: number[]): Promise<Map<number, RowDataPacket[]>> {
  const porCandidatura = new Map<number, RowDataPacket[]>();

  if (idsCandidaturas.length === 0) {
    return porCandidatura;
  }

  const [linhas] = await pool.query<RowDataPacket[]>(
    `SELECT IDCANDIDATURA, PERGUNTA, RESPOSTA FROM TBLCDSCANDRESP0
     WHERE IDCANDIDATURA IN (${idsCandidaturas.map(() => '?').join(',')})
     ORDER BY IDRESPOSTA`,
    idsCandidaturas
  );

  for (const linha of linhas) {
    const id = linha['IDCANDIDATURA'] as number;
    porCandidatura.set(id, [...(porCandidatura.get(id) ?? []), linha]);
  }

  return porCandidatura;
}

//
//* Remove a vaga, só se ela pertencer à empresa informada. Lança 404 tanto se
//* o id não existir quanto se a vaga for de outra empresa — não dá pra saber
//* qual dos dois casos é, pra não revelar dados de vagas de outra empresa.
//
export async function remover(id: number, idEmpresa: number): Promise<void> {
  await garantirEmpresaAtiva(idEmpresa);

  const [resultado] = await pool.execute<ResultSetHeader>(
    'DELETE FROM TBLCDSVAG0 WHERE IDVAGA = ? AND IDEMPRESA = ?',
    [id, idEmpresa]
  );

  if (resultado.affectedRows === 0) {
    throw erroNaoEncontrado('Vaga não encontrada.');
  }
}
