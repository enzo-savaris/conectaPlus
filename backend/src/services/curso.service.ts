import fs from 'node:fs/promises';
import path from 'node:path';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { PASTA_UPLOADS_CURSOS } from '../config/upload.ts';
import pool from '../config/dataBase.ts';
import { erroDeValidacao, erroNaoEncontrado } from '../utils/erro-app.ts';
import type { DadosCurso } from '../utils/validacao-curso.ts';

const COLUNAS = `IDCURSO, IDEMPRESA, TITULO, DESCRICAO, CARGAHORARIA, PRECO,
                 TIPOCONTEUDO, LINKCURSO, ARQUIVOCURSO, DTCAD, STATUSCURSO`;

/**
 * Lista os cursos cadastrados, dos mais recentes para os mais antigos.
 * Quando `idEmpresa` é informado, traz só os cursos daquela empresa.
 */
export async function listar(idEmpresa?: number): Promise<RowDataPacket[]> {
  if (idEmpresa !== undefined) {
    const [linhas] = await pool.query<RowDataPacket[]>(
      `SELECT ${COLUNAS} FROM TBLCDSCURSO0 WHERE IDEMPRESA = ? ORDER BY DTCAD DESC`,
      [idEmpresa]
    );
    return linhas;
  }

  const [linhas] = await pool.query<RowDataPacket[]>(
    `SELECT ${COLUNAS} FROM TBLCDSCURSO0 ORDER BY DTCAD DESC`
  );

  return linhas;
}

export async function buscarPorId(id: number): Promise<RowDataPacket | null> {
  const [linhas] = await pool.query<RowDataPacket[]>(
    `SELECT ${COLUNAS} FROM TBLCDSCURSO0 WHERE IDCURSO = ?`,
    [id]
  );

  return linhas[0] ?? null;
}

export async function obterPorId(id: number): Promise<RowDataPacket> {
  const curso = await buscarPorId(id);

  if (curso === null) {
    throw erroNaoEncontrado('Curso não encontrado.');
  }

  return curso;
}

/** Remove o arquivo do disco quando ele é trocado ou o curso passa a usar um link. */
async function removerArquivo(nomeArquivo: string | null): Promise<void> {
  if (!nomeArquivo) {
    return;
  }

  try {
    await fs.unlink(path.join(PASTA_UPLOADS_CURSOS, nomeArquivo));
  } catch {
    // Já pode ter sido removido manualmente; não é motivo pra falhar a operação.
  }
}

export async function cadastrar(
  dados: DadosCurso,
  idEmpresa: number,
  nomeArquivo: string | null
): Promise<RowDataPacket> {
  if (dados.tipoConteudo === 'ARQUIVO' && !nomeArquivo) {
    await removerArquivo(nomeArquivo);
    throw erroDeValidacao({ arquivo: 'Anexe um vídeo ou escolha cadastrar com um link.' });
  }

  const [resultado] = await pool.execute<ResultSetHeader>(
    `INSERT INTO TBLCDSCURSO0
      (IDEMPRESA, TITULO, DESCRICAO, CARGAHORARIA, PRECO, TIPOCONTEUDO, LINKCURSO, ARQUIVOCURSO)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      idEmpresa,
      dados.titulo,
      dados.descricao,
      dados.cargaHoraria,
      dados.preco,
      dados.tipoConteudo,
      dados.tipoConteudo === 'LINK' ? dados.linkCurso : null,
      dados.tipoConteudo === 'ARQUIVO' ? nomeArquivo : null
    ]
  );

  return obterPorId(resultado.insertId);
}

/**
 * Atualiza o curso, só se ele pertencer à empresa informada. Se o tipo virar
 * ARQUIVO sem um arquivo novo enviado, mantém o já cadastrado; se virar LINK,
 * ou um arquivo novo for enviado, o arquivo antigo é apagado do disco pra não
 * acumular vídeo órfão.
 */
export async function atualizar(
  id: number,
  dados: DadosCurso,
  idEmpresa: number,
  nomeArquivoNovo: string | null
): Promise<RowDataPacket> {
  const [linhas] = await pool.query<RowDataPacket[]>(
    'SELECT ARQUIVOCURSO FROM TBLCDSCURSO0 WHERE IDCURSO = ? AND IDEMPRESA = ?',
    [id, idEmpresa]
  );

  const atual = linhas[0];
  if (!atual) {
    await removerArquivo(nomeArquivoNovo);
    throw erroNaoEncontrado('Curso não encontrado.');
  }

  const arquivoAtual = atual['ARQUIVOCURSO'] as string | null;
  let arquivoFinal: string | null;

  if (dados.tipoConteudo === 'LINK') {
    await removerArquivo(arquivoAtual);
    arquivoFinal = null;
  } else if (nomeArquivoNovo) {
    await removerArquivo(arquivoAtual);
    arquivoFinal = nomeArquivoNovo;
  } else {
    arquivoFinal = arquivoAtual;
  }

  if (dados.tipoConteudo === 'ARQUIVO' && !arquivoFinal) {
    throw erroDeValidacao({ arquivo: 'Anexe um vídeo ou escolha cadastrar com um link.' });
  }

  await pool.execute(
    `UPDATE TBLCDSCURSO0 SET
      TITULO = ?, DESCRICAO = ?, CARGAHORARIA = ?, PRECO = ?,
      TIPOCONTEUDO = ?, LINKCURSO = ?, ARQUIVOCURSO = ?
     WHERE IDCURSO = ?`,
    [
      dados.titulo,
      dados.descricao,
      dados.cargaHoraria,
      dados.preco,
      dados.tipoConteudo,
      dados.tipoConteudo === 'LINK' ? dados.linkCurso : null,
      arquivoFinal,
      id
    ]
  );

  return obterPorId(id);
}
