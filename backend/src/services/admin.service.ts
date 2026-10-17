import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import pool from '../config/dataBase.ts';
import { ErroApp, erroDeConflito, erroDeValidacao, erroNaoEncontrado } from '../utils/erro-app.ts';
import { gerarHashSenha, senhaConfere } from '../utils/senha.ts';
import { gerarToken } from '../utils/token.ts';

/**
 * Ambiente da equipe Conecta+ (TBLCDSADM0): login com e-mail e senha,
 * validação dos cadastros de empresa e gestão da própria equipe.
 */

/** Sessão da equipe dura 12 horas; depois disso, entra de novo. */
const VALIDADE_TOKEN_SEGUNDOS = 12 * 60 * 60;

export type StatusEmpresa = 'ATIVA' | 'INATIVA' | 'PENDENTE' | 'RECUSADA';
export type AcaoEmpresa = 'APROVAR' | 'RECUSAR' | 'INATIVAR';

/** Para qual status cada ação leva, e de quais ela pode partir. */
const REGRAS_ACAO: Record<AcaoEmpresa, { destino: StatusEmpresa; origens: StatusEmpresa[]; exigeMotivo: boolean }> = {
  // Aprovar também serve para reativar uma inativa ou rever uma recusa.
  APROVAR: { destino: 'ATIVA', origens: ['PENDENTE', 'INATIVA', 'RECUSADA'], exigeMotivo: false },
  RECUSAR: { destino: 'RECUSADA', origens: ['PENDENTE'], exigeMotivo: true },
  INATIVAR: { destino: 'INATIVA', origens: ['ATIVA'], exigeMotivo: true }
};

const COLUNAS_EMPRESA = `e.IDEMPRESA, e.RAZAO, e.FANTASIA, e.CNPJ, e.EMAIL, e.TELEFONE, e.CEP, e.NUMERO,
  e.COMPLEMENTO, e.BAIRRO, e.CIDADE, e.ESTADO, e.DTCAD, e.DTALT, e.STATUSEMP`;

// ============ LOGIN ============

export async function autenticar(email: string, senha: string): Promise<Record<string, unknown>> {
  const [linhas] = await pool.query<RowDataPacket[]>(
    "SELECT IDADMIN, NOME, EMAIL, SENHA FROM TBLCDSADM0 WHERE EMAIL = ? AND STATUSADM = 'ATIVO'",
    [email]
  );

  const admin = linhas[0];
  // Mesma mensagem para e-mail inexistente e senha errada: não revela quais e-mails são da equipe.
  if (!admin || !(await senhaConfere(senha, admin['SENHA'] as string))) {
    throw new ErroApp(401, 'E-mail ou senha incorretos.');
  }

  await pool.execute('UPDATE TBLCDSADM0 SET DTULTIMOACESSO = NOW() WHERE IDADMIN = ?', [admin['IDADMIN']]);

  return {
    ambiente: 'admin',
    token: gerarToken(`admin:${admin['IDADMIN']}`, VALIDADE_TOKEN_SEGUNDOS),
    perfil: { id: admin['IDADMIN'], nome: admin['NOME'], email: admin['EMAIL'] }
  };
}

// ============ EMPRESAS ============

/** Quantas empresas há em cada status (os números das abas). */
export async function contarEmpresas(): Promise<Record<StatusEmpresa, number>> {
  const [linhas] = await pool.query<RowDataPacket[]>(
    'SELECT STATUSEMP, COUNT(*) AS TOTAL FROM TBLCDSEMP0 GROUP BY STATUSEMP'
  );

  const contagem: Record<StatusEmpresa, number> = { PENDENTE: 0, ATIVA: 0, INATIVA: 0, RECUSADA: 0 };
  for (const linha of linhas) {
    contagem[linha['STATUSEMP'] as StatusEmpresa] = Number(linha['TOTAL']);
  }
  return contagem;
}

/**
 * Lista as empresas de um status, buscando por razão social, nome fantasia,
 * CNPJ ou e-mail. Pendentes vêm das mais antigas para as mais novas (fila de
 * análise: quem esperou mais é atendido primeiro); os demais, das mais recentes.
 */
export async function listarEmpresas(status: StatusEmpresa, busca: string): Promise<RowDataPacket[]> {
  const parametros: (string | number)[] = [status];
  let filtroBusca = '';

  if (busca) {
    const termo = `%${busca}%`;
    const digitos = busca.replace(/\D/g, '');
    filtroBusca = 'AND (e.RAZAO LIKE ? OR e.FANTASIA LIKE ? OR e.EMAIL LIKE ?' + (digitos ? ' OR e.CNPJ LIKE ?' : '') + ')';
    parametros.push(termo, termo, termo);
    if (digitos) {
      parametros.push(`%${digitos}%`);
    }
  }

  const [linhas] = await pool.query<RowDataPacket[]>(
    `SELECT ${COLUNAS_EMPRESA},
            (SELECT h.DTCAD FROM TBLCDSEMPHIST0 h WHERE h.IDEMPRESA = e.IDEMPRESA ORDER BY h.IDHISTORICO DESC LIMIT 1) AS DTULTIMADECISAO
     FROM TBLCDSEMP0 e
     WHERE e.STATUSEMP = ? ${filtroBusca}
     ORDER BY COALESCE(e.DTALT, e.DTCAD) ${status === 'PENDENTE' ? 'ASC' : 'DESC'}
     LIMIT 200`,
    parametros
  );

  return linhas;
}

/** Empresa com o histórico de decisões e um resumo do que ela já publicou. */
export async function obterEmpresa(idEmpresa: number): Promise<Record<string, unknown>> {
  const [linhas] = await pool.query<RowDataPacket[]>(`SELECT ${COLUNAS_EMPRESA} FROM TBLCDSEMP0 e WHERE e.IDEMPRESA = ?`, [
    idEmpresa
  ]);

  const empresa = linhas[0];
  if (!empresa) {
    throw erroNaoEncontrado('Empresa não encontrada.');
  }

  const [[historico], [[resumo]]] = await Promise.all([
    pool.query<RowDataPacket[]>(
      `SELECT h.STATUSANTERIOR, h.STATUSNOVO, h.MOTIVO, h.DTCAD, a.NOME AS NOMEADMIN
       FROM TBLCDSEMPHIST0 h LEFT JOIN TBLCDSADM0 a ON a.IDADMIN = h.IDADMIN
       WHERE h.IDEMPRESA = ? ORDER BY h.IDHISTORICO DESC`,
      [idEmpresa]
    ),
    pool.query<RowDataPacket[]>(
      `SELECT (SELECT COUNT(*) FROM TBLCDSVAG0 WHERE IDEMPRESA = ?) AS TOTALVAGAS,
              (SELECT COUNT(*) FROM TBLCDSCURSO0 WHERE IDEMPRESA = ?) AS TOTALCURSOS`,
      [idEmpresa, idEmpresa]
    )
  ]);

  // Outras empresas com o mesmo e-mail ou telefone: sinal para conferir duplicidade/fraude.
  const [semelhantes] = await pool.query<RowDataPacket[]>(
    `SELECT IDEMPRESA, RAZAO, CNPJ, STATUSEMP FROM TBLCDSEMP0
     WHERE IDEMPRESA <> ? AND ((EMAIL IS NOT NULL AND EMAIL = ?) OR (TELEFONE IS NOT NULL AND TELEFONE = ?))
     LIMIT 10`,
    [idEmpresa, empresa['EMAIL'], empresa['TELEFONE']]
  );

  return {
    ...empresa,
    historico,
    TOTALVAGAS: Number(resumo?.['TOTALVAGAS'] ?? 0),
    TOTALCURSOS: Number(resumo?.['TOTALCURSOS'] ?? 0),
    semelhantes
  };
}

export async function decidir(
  idEmpresa: number,
  acao: AcaoEmpresa,
  motivo: string | null,
  idAdmin: number
): Promise<Record<string, unknown>> {
  const regra = REGRAS_ACAO[acao];

  if (regra.exigeMotivo && !motivo) {
    throw erroDeValidacao({ motivo: 'Explique o motivo: a empresa vai ver esse texto.' });
  }

  const conexao = await pool.getConnection();

  try {
    await conexao.beginTransaction();

    const [linhas] = await conexao.query<RowDataPacket[]>(
      'SELECT STATUSEMP FROM TBLCDSEMP0 WHERE IDEMPRESA = ? FOR UPDATE',
      [idEmpresa]
    );
    const atual = linhas[0]?.['STATUSEMP'] as StatusEmpresa | undefined;

    if (!atual) {
      throw erroNaoEncontrado('Empresa não encontrada.');
    }
    if (!regra.origens.includes(atual)) {
      throw erroDeConflito('Essa ação não se aplica ao status atual da empresa. Atualize a página.');
    }

    await conexao.execute('UPDATE TBLCDSEMP0 SET STATUSEMP = ? WHERE IDEMPRESA = ?', [regra.destino, idEmpresa]);
    await conexao.execute(
      'INSERT INTO TBLCDSEMPHIST0 (IDEMPRESA, IDADMIN, STATUSANTERIOR, STATUSNOVO, MOTIVO) VALUES (?, ?, ?, ?, ?)',
      [idEmpresa, idAdmin, atual, regra.destino, motivo]
    );

    await conexao.commit();
  } catch (erro) {
    await conexao.rollback();
    throw erro;
  } finally {
    conexao.release();
  }

  return obterEmpresa(idEmpresa);
}

/** Último motivo registrado pela equipe para o status atual (mostrado à empresa recusada/inativada). */
export async function motivoAtual(idEmpresa: number): Promise<string | null> {
  const [linhas] = await pool.query<RowDataPacket[]>(
    `SELECT h.MOTIVO FROM TBLCDSEMPHIST0 h
     INNER JOIN TBLCDSEMP0 e ON e.IDEMPRESA = h.IDEMPRESA AND e.STATUSEMP = h.STATUSNOVO
     WHERE h.IDEMPRESA = ? ORDER BY h.IDHISTORICO DESC LIMIT 1`,
    [idEmpresa]
  );

  return (linhas[0]?.['MOTIVO'] as string | null | undefined) ?? null;
}

// ============ EQUIPE ============

export async function listarEquipe(): Promise<RowDataPacket[]> {
  const [linhas] = await pool.query<RowDataPacket[]>(
    `SELECT a.IDADMIN, a.NOME, a.EMAIL, a.STATUSADM, a.DTCAD, a.DTULTIMOACESSO,
            (SELECT COUNT(*) FROM TBLCDSEMPHIST0 h WHERE h.IDADMIN = a.IDADMIN) AS TOTALDECISOES
     FROM TBLCDSADM0 a ORDER BY a.STATUSADM, a.NOME`
  );
  return linhas;
}

export async function criarMembro(nome: string, email: string, senha: string): Promise<RowDataPacket[]> {
  const [existentes] = await pool.query<RowDataPacket[]>('SELECT IDADMIN FROM TBLCDSADM0 WHERE EMAIL = ?', [email]);
  if (existentes.length > 0) {
    throw erroDeConflito('Já existe alguém da equipe com esse e-mail.', { email: 'E-mail já cadastrado.' });
  }

  await pool.execute<ResultSetHeader>('INSERT INTO TBLCDSADM0 (NOME, EMAIL, SENHA) VALUES (?, ?, ?)', [
    nome,
    email,
    await gerarHashSenha(senha)
  ]);

  return listarEquipe();
}

/** Ativa/desativa um membro. Ninguém desativa a si mesmo, e a equipe nunca fica sem nenhum ativo. */
export async function alterarStatusMembro(
  idMembro: number,
  ativo: boolean,
  idAdminLogado: number
): Promise<RowDataPacket[]> {
  if (!ativo && idMembro === idAdminLogado) {
    throw erroDeConflito('Você não pode desativar o seu próprio acesso.');
  }

  const [resultado] = await pool.execute<ResultSetHeader>('UPDATE TBLCDSADM0 SET STATUSADM = ? WHERE IDADMIN = ?', [
    ativo ? 'ATIVO' : 'INATIVO',
    idMembro
  ]);

  if (resultado.affectedRows === 0) {
    throw erroNaoEncontrado('Membro da equipe não encontrado.');
  }

  return listarEquipe();
}
