import fs from 'node:fs/promises';
import path from 'node:path';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { PASTA_UPLOADS_AVATARES_PCD, PASTA_UPLOADS_CURRICULOS_PCD } from '../config/upload.ts';
import pool from '../config/dataBase.ts';
import { erroDeConflito, erroNaoEncontrado } from '../utils/erro-app.ts';
import { gerarHashSenha } from '../utils/senha.ts';
import type { DadosCandidato, DadosPerfilCandidato } from '../utils/validacao-candidato.ts';

/**
 * Camada de acesso ao banco dos candidatos PCD (tabela TBLCDSUSR0).
 */

/**
 * As colunas são listadas uma a uma de propósito: com SELECT * a coluna
 * SENHA iria junto na resposta da API.
 */
const COLUNAS = `IDPCD, NOME, EMAIL, TELEFONE, CPF, SOBREMIM, TIPODEF,
                 CIDADE, ESTADO, AVATAR, TITULOPROFISSIONAL, TIPOCURRICULO,
                 CURRICULOPDF, DTCAD, STATUSPCD`;

/** Tabelas filhas de múltipla escolha do perfil, uma linha de texto por item. */
const TABELAS_DE_ITENS = {
  recursos: 'TBLCDSPCDREC0',
  interesses: 'TBLCDSPCDINT0',
  habilidades: 'TBLCDSPCDHAB0'
} as const;

type ChaveDeItens = keyof typeof TABELAS_DE_ITENS;

/** Lista os usuários cadastrados, em ordem alfabética. */
export async function listar(): Promise<RowDataPacket[]> {
  const [usuarios] = await pool.query<RowDataPacket[]>(
    `SELECT ${COLUNAS} FROM TBLCDSUSR0 ORDER BY NOME`
  );

  return usuarios;
}

async function obterPorId(id: number): Promise<RowDataPacket> {
  const [linhas] = await pool.query<RowDataPacket[]>(
    `SELECT ${COLUNAS} FROM TBLCDSUSR0 WHERE IDPCD = ?`,
    [id]
  );

  const usuario = linhas[0];
  if (!usuario) {
    throw erroNaoEncontrado('Candidato não encontrado.');
  }

  return usuario;
}

async function listarItens(chave: ChaveDeItens, idPcd: number): Promise<string[]> {
  const tabela = TABELAS_DE_ITENS[chave];
  const [linhas] = await pool.query<RowDataPacket[]>(
    `SELECT DESCRICAO FROM ${tabela} WHERE IDPCD = ? ORDER BY DESCRICAO`,
    [idPcd]
  );

  return linhas.map((linha) => linha['DESCRICAO'] as string);
}

async function listarExperiencias(idPcd: number): Promise<RowDataPacket[]> {
  const [linhas] = await pool.query<RowDataPacket[]>(
    'SELECT IDEXPERIENCIA, CARGO, EMPRESA, PERIODO, DESCRICAO FROM TBLCDSPCDEXP0 WHERE IDPCD = ? ORDER BY IDEXPERIENCIA',
    [idPcd]
  );

  return linhas;
}

async function listarFormacoes(idPcd: number): Promise<RowDataPacket[]> {
  const [linhas] = await pool.query<RowDataPacket[]>(
    'SELECT IDFORMACAO, CURSO, INSTITUICAO, PERIODO FROM TBLCDSPCDFORM0 WHERE IDPCD = ? ORDER BY IDFORMACAO',
    [idPcd]
  );

  return linhas;
}

/** Perfil completo do candidato: dados básicos + as listas do currículo montado pela plataforma. */
export async function obterDetalhado(id: number): Promise<Record<string, unknown>> {
  const usuario = await obterPorId(id);

  const [recursos, interesses, habilidades, experiencias, formacoes] = await Promise.all([
    listarItens('recursos', id),
    listarItens('interesses', id),
    listarItens('habilidades', id),
    listarExperiencias(id),
    listarFormacoes(id)
  ]);

  return { ...usuario, recursos, interesses, habilidades, experiencias, formacoes };
}

/**
 * Confirma que o candidato já se candidatou a alguma vaga da empresa
 * informada — é o que dá à empresa o direito de ver o perfil completo dele.
 * Lança 404 (em vez de 403) pra não revelar se o candidato existe ou não.
 */
export async function confirmarRelacionamento(idPcd: number, idEmpresa: number): Promise<void> {
  const [linhas] = await pool.query<RowDataPacket[]>(
    `SELECT c.IDCANDIDATURA
       FROM TBLCDSCAND0 c
       INNER JOIN TBLCDSVAG0 v ON v.IDVAGA = c.IDVAGA
      WHERE c.IDPCD = ? AND v.IDEMPRESA = ?
      LIMIT 1`,
    [idPcd, idEmpresa]
  );

  if (linhas.length === 0) {
    throw erroNaoEncontrado('Candidato não encontrado.');
  }
}

/** Remove o arquivo do disco quando uma operação falha depois que ele já foi salvo. */
async function removerArquivo(pasta: string, nomeArquivo: string | null): Promise<void> {
  if (!nomeArquivo) {
    return;
  }

  try {
    await fs.unlink(path.join(pasta, nomeArquivo));
  } catch {
    // Já pode ter sido removido manualmente; não é motivo pra falhar a operação.
  }
}

async function garantirQueNaoDuplica(cpf: string, email: string): Promise<void> {
  const [linhas] = await pool.query<RowDataPacket[]>(
    'SELECT CPF, EMAIL FROM TBLCDSUSR0 WHERE CPF = ? OR EMAIL = ?',
    [cpf, email]
  );

  const erros: Record<string, string> = {};

  for (const linha of linhas) {
    if (linha['CPF'] === cpf) {
      erros['cpf'] = 'Já existe um cadastro com este CPF.';
    }
    if (linha['EMAIL'] === email) {
      erros['email'] = 'Já existe um cadastro com este e-mail.';
    }
  }

  if (Object.keys(erros).length > 0) {
    throw erroDeConflito('Candidato já cadastrado.', erros);
  }
}

/** Confere que o e-mail não pertence a outro candidato, ao trocá-lo na edição do perfil. */
async function garantirEmailDisponivel(email: string, idIgnorado: number): Promise<void> {
  const [linhas] = await pool.query<RowDataPacket[]>(
    'SELECT IDPCD FROM TBLCDSUSR0 WHERE EMAIL = ? AND IDPCD <> ?',
    [email, idIgnorado]
  );

  if (linhas.length > 0) {
    throw erroDeConflito('Já existe um cadastro com este e-mail.', { email: 'Já existe um cadastro com este e-mail.' });
  }
}

async function inserirItens(
  conexao: PoolConnection,
  chave: ChaveDeItens,
  idPcd: number,
  itens: string[]
): Promise<void> {
  if (itens.length === 0) {
    return;
  }

  const tabela = TABELAS_DE_ITENS[chave];
  const valores = itens.map((item) => [idPcd, item]);
  await conexao.query(`INSERT INTO ${tabela} (IDPCD, DESCRICAO) VALUES ?`, [valores]);
}

async function removerItens(conexao: PoolConnection, chave: ChaveDeItens, idPcd: number): Promise<void> {
  const tabela = TABELAS_DE_ITENS[chave];
  await conexao.query(`DELETE FROM ${tabela} WHERE IDPCD = ?`, [idPcd]);
}

/**
 * Cadastra o candidato PCD. A foto de perfil é opcional: `nomeArquivoAvatar`
 * vem `null` quando ninguém anexou nada, e o front usa um ícone de placeholder.
 */
export async function cadastrar(
  dados: DadosCandidato,
  nomeArquivoAvatar: string | null
): Promise<RowDataPacket> {
  try {
    await garantirQueNaoDuplica(dados.cpf, dados.email);
  } catch (erro) {
    await removerArquivo(PASTA_UPLOADS_AVATARES_PCD, nomeArquivoAvatar);
    throw erro;
  }

  const conexao = await pool.getConnection();

  try {
    await conexao.beginTransaction();

    const senhaHash = await gerarHashSenha(dados.senha);

    const [resultado] = await conexao.execute<ResultSetHeader>(
      `INSERT INTO TBLCDSUSR0 (NOME, EMAIL, TELEFONE, CPF, SENHA, TIPODEF, AVATAR, STATUSPCD)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'ATIVO')`,
      [dados.nome, dados.email, dados.telefone, dados.cpf, senhaHash, dados.tipoDeficiencia, nomeArquivoAvatar]
    );

    const idPcd = resultado.insertId;

    await inserirItens(conexao, 'recursos', idPcd, dados.recursos);
    await inserirItens(conexao, 'interesses', idPcd, dados.interesses);

    await conexao.commit();

    return await obterPorId(idPcd);
  } catch (erro) {
    await conexao.rollback();
    await removerArquivo(PASTA_UPLOADS_AVATARES_PCD, nomeArquivoAvatar);
    throw erro;
  } finally {
    conexao.release();
  }
}

/**
 * Atualiza o perfil do candidato — dados básicos, currículo montado pela
 * plataforma (experiência, formação, habilidades) e/ou um PDF anexado, foto
 * de perfil. Só mexe no que veio no corpo da requisição (PUT parcial).
 */
export async function atualizar(
  id: number,
  dados: DadosPerfilCandidato,
  novoAvatar: string | null,
  novoCurriculoPdf: string | null
): Promise<Record<string, unknown>> {
  const conexao = await pool.getConnection();

  try {
    await conexao.beginTransaction();

    const [linhasAtuais] = await conexao.query<RowDataPacket[]>(
      'SELECT AVATAR, CURRICULOPDF FROM TBLCDSUSR0 WHERE IDPCD = ? FOR UPDATE',
      [id]
    );
    const atual = linhasAtuais[0];

    if (!atual) {
      throw erroNaoEncontrado('Candidato não encontrado.');
    }

    if (dados.email !== undefined) {
      await garantirEmailDisponivel(dados.email, id);
    }

    const atribuicoes: string[] = [];
    const parametros: (string | number | null)[] = [];

    const camposSimples: Record<string, string> = {
      nome: 'NOME',
      email: 'EMAIL',
      telefone: 'TELEFONE',
      tituloProfissional: 'TITULOPROFISSIONAL',
      sobreMim: 'SOBREMIM',
      cidade: 'CIDADE',
      estado: 'ESTADO',
      tipoDeficiencia: 'TIPODEF',
      tipoCurriculo: 'TIPOCURRICULO'
    };

    for (const [campo, coluna] of Object.entries(camposSimples)) {
      const valor = dados[campo as keyof DadosPerfilCandidato];
      if (valor !== undefined) {
        atribuicoes.push(`${coluna} = ?`);
        parametros.push(valor as string | null);
      }
    }

    if (dados.senha !== undefined) {
      atribuicoes.push('SENHA = ?');
      parametros.push(await gerarHashSenha(dados.senha));
    }

    const avatarAntigo = atual['AVATAR'] as string | null;
    if (novoAvatar) {
      atribuicoes.push('AVATAR = ?');
      parametros.push(novoAvatar);
    }

    const curriculoAntigo = atual['CURRICULOPDF'] as string | null;
    let curriculoParaRemover: string | null = null;

    if (novoCurriculoPdf) {
      atribuicoes.push('CURRICULOPDF = ?');
      parametros.push(novoCurriculoPdf);
      curriculoParaRemover = curriculoAntigo;
    } else if (dados.tipoCurriculo === 'PLATAFORMA' && curriculoAntigo) {
      // Voltou a montar o currículo pela plataforma: o PDF antigo deixa de valer.
      atribuicoes.push('CURRICULOPDF = NULL');
      curriculoParaRemover = curriculoAntigo;
    }

    if (atribuicoes.length > 0) {
      parametros.push(id);
      await conexao.execute(`UPDATE TBLCDSUSR0 SET ${atribuicoes.join(', ')} WHERE IDPCD = ?`, parametros);
    }

    for (const chave of Object.keys(TABELAS_DE_ITENS) as ChaveDeItens[]) {
      const itens = dados[chave];
      if (itens !== undefined) {
        await removerItens(conexao, chave, id);
        await inserirItens(conexao, chave, id, itens);
      }
    }

    if (dados.experiencias !== undefined) {
      await conexao.query('DELETE FROM TBLCDSPCDEXP0 WHERE IDPCD = ?', [id]);
      if (dados.experiencias.length > 0) {
        const valores = dados.experiencias.map((exp) => [id, exp.cargo, exp.empresa, exp.periodo, exp.descricao]);
        await conexao.query(
          'INSERT INTO TBLCDSPCDEXP0 (IDPCD, CARGO, EMPRESA, PERIODO, DESCRICAO) VALUES ?',
          [valores]
        );
      }
    }

    if (dados.formacoes !== undefined) {
      await conexao.query('DELETE FROM TBLCDSPCDFORM0 WHERE IDPCD = ?', [id]);
      if (dados.formacoes.length > 0) {
        const valores = dados.formacoes.map((form) => [id, form.curso, form.instituicao, form.periodo]);
        await conexao.query('INSERT INTO TBLCDSPCDFORM0 (IDPCD, CURSO, INSTITUICAO, PERIODO) VALUES ?', [valores]);
      }
    }

    await conexao.commit();

    if (novoAvatar) {
      await removerArquivo(PASTA_UPLOADS_AVATARES_PCD, avatarAntigo);
    }
    if (curriculoParaRemover) {
      await removerArquivo(PASTA_UPLOADS_CURRICULOS_PCD, curriculoParaRemover);
    }

    return await obterDetalhado(id);
  } catch (erro) {
    await conexao.rollback();
    await removerArquivo(PASTA_UPLOADS_AVATARES_PCD, novoAvatar);
    await removerArquivo(PASTA_UPLOADS_CURRICULOS_PCD, novoCurriculoPdf);
    throw erro;
  } finally {
    conexao.release();
  }
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
