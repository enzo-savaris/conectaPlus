import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import pool from '../config/dataBase.ts';
import {
  cancelarPagamentoMercadoPago,
  consultarPagamentoMercadoPago,
  criarPagamentoMercadoPago,
  reembolsarPagamentoMercadoPago,
  formatarDataMercadoPago,
  urlNotificacaoMercadoPago,
  type PagamentoMercadoPago
} from '../config/mercadopago.ts';
import { ehPago } from './curso.service.ts';
import { ErroApp, erroDeConflito, erroNaoEncontrado } from '../utils/erro-app.ts';
import type { DadosAvaliacao, DadosMatricula, DadosPagamento } from '../utils/validacao-matricula.ts';

/**
 * Matrícula em cursos e pagamento pelo Mercado Pago.
 *
 * Fluxo de um curso pago:
 * 1. `matricular` cria a matrícula PENDENTE, guardando o preço do momento.
 * 2. `pagar` cria a cobrança no Mercado Pago (Pix ou cartão) e grava a
 *    tentativa na TBLCDSPAG0.
 * 3. Quando o Mercado Pago aprova — na hora (cartão), ou depois, quando o
 *    Pix é pago (avisado pelo webhook ou pela consulta que a tela faz a cada
 *    poucos segundos) — `aplicarStatus` marca o pagamento APROVADO e a
 *    matrícula ATIVA, o que libera o conteúdo do curso.
 *
 * O status é sempre lido da API do Mercado Pago (nunca do que o navegador
 * diz), e o valor aprovado é conferido com o valor da matrícula antes de
 * liberar o curso.
 */

/** Pix expira em 30 minutos; depois disso a tela gera outro. */
const VALIDADE_PIX_MS = 30 * 60 * 1000;

const COLUNAS_PAGAMENTO = `IDPAGAMENTO, IDMATRICULA, METODO, VALOR, PARCELAS, STATUSPAGAMENTO, DETALHESTATUS,
  PIXCOPIACOLA, PIXQRCODE, PIXEXPIRACAO, CARTAOBANDEIRA, CARTAOFINAL, DTCAD, DTATUALIZACAO`;

type StatusPagamento = 'PENDENTE' | 'APROVADO' | 'RECUSADO' | 'CANCELADO' | 'ESTORNADO';

/** Traduz o status do Mercado Pago para o da plataforma. */
function statusDaPlataforma(statusMercadoPago: string): StatusPagamento {
  switch (statusMercadoPago) {
    case 'approved':
      return 'APROVADO';
    case 'rejected':
      return 'RECUSADO';
    case 'cancelled':
    case 'expired':
      return 'CANCELADO';
    case 'refunded':
    case 'charged_back':
      return 'ESTORNADO';
    default:
      // pending, in_process, authorized, in_mediation
      return 'PENDENTE';
  }
}

async function obterCursoParaMatricula(idCurso: number): Promise<RowDataPacket> {
  const [linhas] = await pool.query<RowDataPacket[]>(
    'SELECT IDCURSO, TITULO, PRECO, STATUSCURSO FROM TBLCDSCURSO0 WHERE IDCURSO = ?',
    [idCurso]
  );

  const curso = linhas[0];
  if (!curso || curso['STATUSCURSO'] !== 'ATIVO') {
    throw erroNaoEncontrado('Curso não encontrado.');
  }

  return curso;
}

async function regravarNecessidades(conexao: PoolConnection, idMatricula: number, necessidades: string[]): Promise<void> {
  await conexao.query('DELETE FROM TBLCDSMATRNEC0 WHERE IDMATRICULA = ?', [idMatricula]);

  if (necessidades.length > 0) {
    await conexao.query('INSERT INTO TBLCDSMATRNEC0 (IDMATRICULA, DESCRICAO) VALUES ?', [
      necessidades.map((item) => [idMatricula, item])
    ]);
  }
}

/**
 * Matricula o candidato no curso (etapa "Dados da matrícula"). Curso gratuito
 * já fica ATIVO; pago fica PENDENTE até o pagamento. Chamar de novo enquanto
 * a matrícula está PENDENTE só atualiza as necessidades de acessibilidade —
 * o candidato pode voltar da etapa de pagamento e corrigir.
 */
export async function matricular(idCurso: number, dados: DadosMatricula): Promise<Record<string, unknown>> {
  const curso = await obterCursoParaMatricula(idCurso);
  const valor = ehPago(curso) ? Number(curso['PRECO']) : 0;

  const conexao = await pool.getConnection();

  try {
    await conexao.beginTransaction();

    const [existentes] = await conexao.query<RowDataPacket[]>(
      'SELECT IDMATRICULA, STATUSMATRICULA FROM TBLCDSMATR0 WHERE IDCURSO = ? AND IDPCD = ? FOR UPDATE',
      [idCurso, dados.idPcd]
    );
    const existente = existentes[0];

    let idMatricula: number;

    if (existente?.['STATUSMATRICULA'] === 'ATIVA') {
      throw erroDeConflito('Você já está matriculado neste curso.');
    }

    if (existente) {
      idMatricula = existente['IDMATRICULA'] as number;
      // PENDENTE (voltou da etapa de pagamento) ou CANCELADA (estorno antigo):
      // recomeça com o preço atual do curso.
      await conexao.execute(
        `UPDATE TBLCDSMATR0 SET VALOR = ?, OBSACESSIBILIDADE = ?, STATUSMATRICULA = ?,
           DTATIVACAO = ${valor === 0 ? 'NOW()' : 'NULL'}
         WHERE IDMATRICULA = ?`,
        [valor, dados.observacao, valor === 0 ? 'ATIVA' : 'PENDENTE', idMatricula]
      );
    } else {
      const [resultado] = await conexao.execute<ResultSetHeader>(
        `INSERT INTO TBLCDSMATR0 (IDCURSO, IDPCD, VALOR, OBSACESSIBILIDADE, STATUSMATRICULA, DTATIVACAO)
         VALUES (?, ?, ?, ?, ?, ${valor === 0 ? 'NOW()' : 'NULL'})`,
        [idCurso, dados.idPcd, valor, dados.observacao, valor === 0 ? 'ATIVA' : 'PENDENTE']
      );
      idMatricula = resultado.insertId;
    }

    await regravarNecessidades(conexao, idMatricula, dados.necessidades);
    await conexao.commit();
  } catch (erro) {
    await conexao.rollback();
    throw erro;
  } finally {
    conexao.release();
  }

  return obterMatricula(dados.idPcd, idCurso);
}

/** Matrícula do candidato no curso, com os dados do curso e a tentativa de pagamento mais recente. */
export async function obterMatricula(idPcd: number, idCurso: number): Promise<Record<string, unknown>> {
  const [linhas] = await pool.query<RowDataPacket[]>(
    `SELECT m.IDMATRICULA, m.IDCURSO, m.VALOR, m.OBSACESSIBILIDADE, m.STATUSMATRICULA, m.DTCAD, m.DTATIVACAO,
            c.TITULO, c.CARGAHORARIA, c.NIVEL, c.CERTIFICADO,
            COALESCE(emp.FANTASIA, emp.RAZAO) AS NOMEEMPRESA
     FROM TBLCDSMATR0 m
     INNER JOIN TBLCDSCURSO0 c ON c.IDCURSO = m.IDCURSO
     LEFT JOIN TBLCDSEMP0 emp ON emp.IDEMPRESA = c.IDEMPRESA
     WHERE m.IDPCD = ? AND m.IDCURSO = ?`,
    [idPcd, idCurso]
  );

  const matricula = linhas[0];
  if (!matricula) {
    throw erroNaoEncontrado('Matrícula não encontrada.');
  }

  const idMatricula = matricula['IDMATRICULA'] as number;

  const [[necessidades], ultimoPagamento] = await Promise.all([
    pool.query<RowDataPacket[]>(
      'SELECT DESCRICAO FROM TBLCDSMATRNEC0 WHERE IDMATRICULA = ? ORDER BY IDNECESSIDADE',
      [idMatricula]
    ),
    buscarUltimoPagamento(idMatricula)
  ]);

  return {
    ...matricula,
    necessidades: necessidades.map((linha) => linha['DESCRICAO'] as string),
    pagamento: ultimoPagamento
  };
}

/** Lista os cursos em que o candidato tem matrícula (ativa ou aguardando pagamento). */
export async function listarMatriculas(idPcd: number): Promise<RowDataPacket[]> {
  const [linhas] = await pool.query<RowDataPacket[]>(
    `SELECT m.IDMATRICULA, m.IDCURSO, m.STATUSMATRICULA, m.DTCAD, m.DTATIVACAO, m.DTCONCLUSAO, c.TITULO
     FROM TBLCDSMATR0 m
     INNER JOIN TBLCDSCURSO0 c ON c.IDCURSO = m.IDCURSO
     WHERE m.IDPCD = ? AND m.STATUSMATRICULA <> 'CANCELADA'
     ORDER BY m.DTCAD DESC`,
    [idPcd]
  );

  return linhas;
}

async function buscarUltimoPagamento(idMatricula: number): Promise<RowDataPacket | null> {
  const [linhas] = await pool.query<RowDataPacket[]>(
    `SELECT ${COLUNAS_PAGAMENTO} FROM TBLCDSPAG0 WHERE IDMATRICULA = ? ORDER BY IDPAGAMENTO DESC LIMIT 1`,
    [idMatricula]
  );

  return linhas[0] ?? null;
}

/** Matrícula do candidato, travada para atualização (evita dois pagamentos simultâneos). */
async function obterMatriculaDoCandidato(
  conexao: PoolConnection,
  idMatricula: number,
  idPcd: number
): Promise<RowDataPacket> {
  const [linhas] = await conexao.query<RowDataPacket[]>(
    `SELECT m.IDMATRICULA, m.IDCURSO, m.VALOR, m.STATUSMATRICULA, c.TITULO
     FROM TBLCDSMATR0 m INNER JOIN TBLCDSCURSO0 c ON c.IDCURSO = m.IDCURSO
     WHERE m.IDMATRICULA = ? AND m.IDPCD = ? FOR UPDATE`,
    [idMatricula, idPcd]
  );

  const matricula = linhas[0];
  if (!matricula) {
    throw erroNaoEncontrado('Matrícula não encontrada.');
  }

  return matricula;
}

/**
 * Cria a cobrança no Mercado Pago. Se já existir um Pix pendente e ainda
 * válido para essa matrícula, devolve o mesmo (em vez de gerar outro QR Code
 * a cada clique).
 */
export async function pagar(idMatricula: number, dados: DadosPagamento): Promise<Record<string, unknown>> {
  const conexao = await pool.getConnection();
  let idPagamento: number;
  let matricula: RowDataPacket;

  try {
    await conexao.beginTransaction();
    matricula = await obterMatriculaDoCandidato(conexao, idMatricula, dados.idPcd);

    if (matricula['STATUSMATRICULA'] === 'ATIVA') {
      throw erroDeConflito('Esta matrícula já está paga.');
    }
    if (Number(matricula['VALOR']) <= 0) {
      throw erroDeConflito('Este curso é gratuito e não precisa de pagamento.');
    }

    if (dados.metodo === 'PIX') {
      const [pixAberto] = await conexao.query<RowDataPacket[]>(
        `SELECT IDPAGAMENTO FROM TBLCDSPAG0
         WHERE IDMATRICULA = ? AND METODO = 'PIX' AND STATUSPAGAMENTO = 'PENDENTE'
           AND IDEXTERNO IS NOT NULL AND PIXEXPIRACAO > NOW()
         ORDER BY IDPAGAMENTO DESC LIMIT 1`,
        [idMatricula]
      );
      if (pixAberto[0]) {
        await conexao.commit();
        return await obterPagamento(pixAberto[0]['IDPAGAMENTO'] as number);
      }
    }

    const [resultado] = await conexao.execute<ResultSetHeader>(
      'INSERT INTO TBLCDSPAG0 (IDMATRICULA, METODO, VALOR, PARCELAS) VALUES (?, ?, ?, ?)',
      [idMatricula, dados.metodo, matricula['VALOR'], dados.metodo === 'CARTAO' ? dados.parcelas : 1]
    );
    idPagamento = resultado.insertId;

    await conexao.commit();
  } catch (erro) {
    await conexao.rollback();
    throw erro;
  } finally {
    conexao.release();
  }

  const [[usuario]] = await pool.query<RowDataPacket[]>(
    'SELECT NOME, EMAIL, CPF FROM TBLCDSUSR0 WHERE IDPCD = ?',
    [dados.idPcd]
  );
  if (!usuario?.['EMAIL']) {
    await marcarFalha(idPagamento, 'sem_email');
    throw new ErroApp(422, 'Cadastre um e-mail no seu perfil antes de pagar — o comprovante é enviado para ele.');
  }

  const [primeiroNome, ...sobrenome] = String(usuario['NOME']).trim().split(/\s+/);
  const cpf = String(usuario['CPF'] ?? '').replace(/\D/g, '');

  const corpo: Record<string, unknown> = {
    transaction_amount: Number(matricula['VALOR']),
    description: `Curso: ${matricula['TITULO']}`.slice(0, 250),
    external_reference: `matricula-${idMatricula}`,
    metadata: { id_matricula: idMatricula, id_pagamento: idPagamento },
    ...(urlNotificacaoMercadoPago() ? { notification_url: urlNotificacaoMercadoPago() } : {})
  };

  if (dados.metodo === 'PIX') {
    Object.assign(corpo, {
      payment_method_id: 'pix',
      date_of_expiration: formatarDataMercadoPago(new Date(Date.now() + VALIDADE_PIX_MS)),
      payer: {
        email: usuario['EMAIL'],
        first_name: primeiroNome,
        last_name: sobrenome.join(' ') || primeiroNome,
        ...(cpf.length === 11 ? { identification: { type: 'CPF', number: cpf } } : {})
      }
    });
  } else {
    Object.assign(corpo, {
      token: dados.token,
      installments: dados.parcelas,
      payment_method_id: dados.bandeira,
      ...(dados.idEmissor ? { issuer_id: Number(dados.idEmissor) } : {}),
      payer: {
        email: dados.email ?? usuario['EMAIL'],
        identification: dados.documento
          ? { type: dados.documento.tipo, number: dados.documento.numero }
          : { type: 'CPF', number: cpf }
      }
    });
  }

  let pagamentoMercadoPago: PagamentoMercadoPago;
  try {
    pagamentoMercadoPago = await criarPagamentoMercadoPago(corpo, `conectaplus-pagamento-${idPagamento}`);
  } catch (erro) {
    await marcarFalha(idPagamento, 'erro_criacao');
    throw erro;
  }

  await aplicarStatus(idPagamento, pagamentoMercadoPago, true);

  return obterPagamento(idPagamento);
}

async function marcarFalha(idPagamento: number, detalhe: string): Promise<void> {
  await pool.execute("UPDATE TBLCDSPAG0 SET STATUSPAGAMENTO = 'CANCELADO', DETALHESTATUS = ? WHERE IDPAGAMENTO = ?", [
    detalhe,
    idPagamento
  ]);
}

async function obterPagamento(idPagamento: number): Promise<Record<string, unknown>> {
  const [linhas] = await pool.query<RowDataPacket[]>(
    `SELECT p.${COLUNAS_PAGAMENTO.split(',').map((c) => c.trim()).join(', p.')}, m.STATUSMATRICULA
     FROM TBLCDSPAG0 p INNER JOIN TBLCDSMATR0 m ON m.IDMATRICULA = p.IDMATRICULA
     WHERE p.IDPAGAMENTO = ?`,
    [idPagamento]
  );

  return linhas[0]!;
}

/** O que fazer depois de gravar o status, fora da transação (são chamadas ao Mercado Pago). */
type Pendencia = { tipo: 'cancelarOutros'; idMatricula: number } | { tipo: 'reembolsarDuplicado'; idExterno: string } | null;

/**
 * Grava o que o Mercado Pago respondeu sobre o pagamento e, se aprovado,
 * ativa a matrícula. Também cobre o caminho inverso: um estorno (refunded /
 * charged_back) cancela a matrícula e bloqueia o conteúdo de novo.
 *
 * Proteção contra cobrança em dobro: quando um pagamento é aprovado, os
 * outros ainda abertos da mesma matrícula (ex.: um Pix gerado antes de a
 * pessoa decidir pagar no cartão) são cancelados no Mercado Pago. E se mesmo
 * assim um segundo pagamento for aprovado (o Pix foi pago no mesmo instante),
 * ele é devolvido automaticamente.
 */
async function aplicarStatus(
  idPagamento: number,
  pagamento: PagamentoMercadoPago,
  dadosDeCriacao = false
): Promise<void> {
  const pendencia = await gravarStatus(idPagamento, pagamento, dadosDeCriacao);

  if (pendencia?.tipo === 'cancelarOutros') {
    await cancelarOutrosPendentes(pendencia.idMatricula, idPagamento);
  } else if (pendencia?.tipo === 'reembolsarDuplicado') {
    await reembolsarDuplicado(idPagamento, pendencia.idExterno);
  }
}

async function gravarStatus(
  idPagamento: number,
  pagamento: PagamentoMercadoPago,
  dadosDeCriacao: boolean
): Promise<Pendencia> {
  const conexao = await pool.getConnection();
  let pendencia: Pendencia = null;

  try {
    await conexao.beginTransaction();

    const [linhas] = await conexao.query<RowDataPacket[]>(
      `SELECT p.IDPAGAMENTO, p.IDMATRICULA, p.VALOR, p.STATUSPAGAMENTO, m.STATUSMATRICULA
       FROM TBLCDSPAG0 p INNER JOIN TBLCDSMATR0 m ON m.IDMATRICULA = p.IDMATRICULA
       WHERE p.IDPAGAMENTO = ? FOR UPDATE`,
      [idPagamento]
    );
    const atual = linhas[0];
    if (!atual) {
      await conexao.commit();
      return null;
    }
    const jaEstavaAprovado = atual['STATUSPAGAMENTO'] === 'APROVADO';

    let status = statusDaPlataforma(pagamento.status);

    // Defesa extra: só libera o curso se o valor aprovado for o valor cobrado.
    if (status === 'APROVADO' && Math.abs(Number(pagamento.transaction_amount) - Number(atual['VALOR'])) > 0.009) {
      console.error(
        `Pagamento ${pagamento.id} aprovado com valor ${pagamento.transaction_amount}, esperado ${atual['VALOR']}.`
      );
      status = 'PENDENTE';
    }

    const pix = pagamento.point_of_interaction?.transaction_data;

    await conexao.execute(
      `UPDATE TBLCDSPAG0 SET IDEXTERNO = ?, STATUSPAGAMENTO = ?, DETALHESTATUS = ?, PARCELAS = ?
         ${dadosDeCriacao ? ', PIXCOPIACOLA = ?, PIXQRCODE = ?, PIXEXPIRACAO = ?, CARTAOBANDEIRA = ?, CARTAOFINAL = ?' : ''}
       WHERE IDPAGAMENTO = ?`,
      [
        String(pagamento.id),
        status,
        pagamento.status_detail?.slice(0, 80) ?? null,
        pagamento.installments || 1,
        ...(dadosDeCriacao
          ? [
              pix?.qr_code ?? null,
              pix?.qr_code_base64 ?? null,
              pagamento.date_of_expiration ? new Date(pagamento.date_of_expiration) : null,
              pagamento.payment_method_id === 'pix' ? null : pagamento.payment_method_id,
              // Só guarda o final se vierem 4 dígitos (em recusas o Mercado Pago às vezes manda mascarado).
              /^\d{4}$/.test(pagamento.card?.last_four_digits ?? '') ? (pagamento.card?.last_four_digits ?? null) : null
            ]
          : []),
        idPagamento
      ]
    );

    if (status === 'APROVADO' && !jaEstavaAprovado) {
      if (atual['STATUSMATRICULA'] === 'ATIVA') {
        // A matrícula já tinha sido paga por outro pagamento: este é duplicado.
        pendencia = { tipo: 'reembolsarDuplicado', idExterno: String(pagamento.id) };
      } else {
        await conexao.execute(
          "UPDATE TBLCDSMATR0 SET STATUSMATRICULA = 'ATIVA', DTATIVACAO = NOW() WHERE IDMATRICULA = ?",
          [atual['IDMATRICULA']]
        );
        pendencia = { tipo: 'cancelarOutros', idMatricula: atual['IDMATRICULA'] as number };
      }
    }

    if (status === 'ESTORNADO' && atual['STATUSMATRICULA'] === 'ATIVA') {
      // Só bloqueia o curso se não sobrou nenhum outro pagamento aprovado —
      // devolver um pagamento duplicado não pode tirar o acesso de quem pagou.
      const [outrosAprovados] = await conexao.query<RowDataPacket[]>(
        "SELECT IDPAGAMENTO FROM TBLCDSPAG0 WHERE IDMATRICULA = ? AND IDPAGAMENTO <> ? AND STATUSPAGAMENTO = 'APROVADO' LIMIT 1",
        [atual['IDMATRICULA'], idPagamento]
      );
      if (outrosAprovados.length === 0) {
        await conexao.execute("UPDATE TBLCDSMATR0 SET STATUSMATRICULA = 'CANCELADA' WHERE IDMATRICULA = ?", [
          atual['IDMATRICULA']
        ]);
      }
    }

    await conexao.commit();
  } catch (erro) {
    await conexao.rollback();
    throw erro;
  } finally {
    conexao.release();
  }

  return pendencia;
}

/** Cancela no Mercado Pago os outros pagamentos ainda abertos da matrícula que acabou de ser paga. */
async function cancelarOutrosPendentes(idMatricula: number, idPagamentoAprovado: number): Promise<void> {
  const [pendentes] = await pool.query<RowDataPacket[]>(
    `SELECT IDPAGAMENTO, IDEXTERNO FROM TBLCDSPAG0
     WHERE IDMATRICULA = ? AND IDPAGAMENTO <> ? AND STATUSPAGAMENTO = 'PENDENTE' AND IDEXTERNO IS NOT NULL`,
    [idMatricula, idPagamentoAprovado]
  );

  for (const pendente of pendentes) {
    try {
      const cancelado = await cancelarPagamentoMercadoPago(String(pendente['IDEXTERNO']));
      if (cancelado.status === 'approved') {
        // Foi pago no exato instante: trata como duplicado.
        await gravarStatus(pendente['IDPAGAMENTO'] as number, cancelado, false);
        await reembolsarDuplicado(pendente['IDPAGAMENTO'] as number, String(pendente['IDEXTERNO']));
        continue;
      }
      await pool.execute(
        "UPDATE TBLCDSPAG0 SET STATUSPAGAMENTO = 'CANCELADO', DETALHESTATUS = 'cancelado_outro_pagamento_aprovado' WHERE IDPAGAMENTO = ?",
        [pendente['IDPAGAMENTO']]
      );
    } catch (erro) {
      // Não impede a matrícula de ser liberada; se esse Pix for pago depois,
      // o webhook/consulta detecta como duplicado e devolve o dinheiro.
      console.error(`Não foi possível cancelar o pagamento ${pendente['IDEXTERNO']} no Mercado Pago:`, erro);
    }
  }
}

/** Devolve um pagamento aprovado em duplicidade. Se falhar, deixa marcado para a equipe devolver pelo painel. */
async function reembolsarDuplicado(idPagamento: number, idExterno: string): Promise<void> {
  try {
    await reembolsarPagamentoMercadoPago(idExterno);
    await pool.execute(
      "UPDATE TBLCDSPAG0 SET STATUSPAGAMENTO = 'ESTORNADO', DETALHESTATUS = 'reembolsado_pagamento_duplicado' WHERE IDPAGAMENTO = ?",
      [idPagamento]
    );
    console.warn(`Pagamento ${idExterno} era duplicado e foi devolvido automaticamente.`);
  } catch (erro) {
    await pool.execute("UPDATE TBLCDSPAG0 SET DETALHESTATUS = 'duplicado_devolver_manual' WHERE IDPAGAMENTO = ?", [
      idPagamento
    ]);
    console.error(`ATENÇÃO: pagamento ${idExterno} foi pago em duplicidade e precisa ser devolvido pelo painel do Mercado Pago.`, erro);
  }
}

/**
 * Pagamento mais recente da matrícula, já sincronizado com o Mercado Pago
 * quando ainda está pendente. A tela do Pix chama isso a cada poucos
 * segundos — assim o curso libera mesmo sem webhook configurado (ex.: rodando
 * só em localhost).
 */
export async function consultarUltimoPagamento(idMatricula: number, idPcd: number): Promise<Record<string, unknown>> {
  const [linhas] = await pool.query<RowDataPacket[]>(
    `SELECT p.IDPAGAMENTO, p.IDEXTERNO, p.STATUSPAGAMENTO
     FROM TBLCDSPAG0 p INNER JOIN TBLCDSMATR0 m ON m.IDMATRICULA = p.IDMATRICULA
     WHERE p.IDMATRICULA = ? AND m.IDPCD = ?
     ORDER BY p.IDPAGAMENTO DESC LIMIT 1`,
    [idMatricula, idPcd]
  );

  const ultimo = linhas[0];
  if (!ultimo) {
    throw erroNaoEncontrado('Nenhum pagamento encontrado para esta matrícula.');
  }

  if (ultimo['STATUSPAGAMENTO'] === 'PENDENTE' && ultimo['IDEXTERNO']) {
    const pagamento = await consultarPagamentoMercadoPago(String(ultimo['IDEXTERNO']));
    await aplicarStatus(ultimo['IDPAGAMENTO'] as number, pagamento);
  }

  return obterPagamento(ultimo['IDPAGAMENTO'] as number);
}

/**
 * Notificação do Mercado Pago (webhook). Não confia no conteúdo da
 * notificação: só usa o id para reconsultar o pagamento direto na API.
 */
export async function processarNotificacao(idExterno: string): Promise<void> {
  const pagamento = await consultarPagamentoMercadoPago(idExterno);

  const [linhas] = await pool.query<RowDataPacket[]>('SELECT IDPAGAMENTO FROM TBLCDSPAG0 WHERE IDEXTERNO = ?', [
    String(pagamento.id)
  ]);

  const registro = linhas[0];
  if (!registro) {
    // Pagamento que não é desta plataforma (ou ainda não gravado); nada a fazer.
    return;
  }

  await aplicarStatus(registro['IDPAGAMENTO'] as number, pagamento);
}

/** Avaliação do curso (1 a 5 estrelas). Só quem tem matrícula ATIVA pode avaliar; avaliar de novo substitui a nota. */
export async function avaliar(idCurso: number, dados: DadosAvaliacao): Promise<void> {
  const [linhas] = await pool.query<RowDataPacket[]>(
    "SELECT IDMATRICULA FROM TBLCDSMATR0 WHERE IDCURSO = ? AND IDPCD = ? AND STATUSMATRICULA = 'ATIVA'",
    [idCurso, dados.idPcd]
  );

  if (linhas.length === 0) {
    throw new ErroApp(403, 'Só quem está matriculado pode avaliar o curso.');
  }

  await pool.execute(
    `INSERT INTO TBLCDSCURSOAVAL0 (IDCURSO, IDPCD, NOTA, COMENTARIO) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE NOTA = VALUES(NOTA), COMENTARIO = VALUES(COMENTARIO), DTCAD = NOW()`,
    [idCurso, dados.idPcd, dados.nota, dados.comentario]
  );
}

/**
 * O aluno marca (ou desmarca) que terminou o curso. Curso pago exige a
 * matrícula ATIVA; curso gratuito pode ser feito sem se matricular antes,
 * então a matrícula é criada aqui na hora, já ativa.
 */
export async function marcarConclusao(idCurso: number, idPcd: number, concluido: boolean): Promise<Record<string, unknown>> {
  const curso = await obterCursoParaMatricula(idCurso);

  const [linhas] = await pool.query<RowDataPacket[]>(
    'SELECT IDMATRICULA, STATUSMATRICULA FROM TBLCDSMATR0 WHERE IDCURSO = ? AND IDPCD = ?',
    [idCurso, idPcd]
  );
  let matricula = linhas[0];

  if (!matricula && !ehPago(curso)) {
    await matricular(idCurso, { idPcd, necessidades: [], observacao: null });
    [[matricula]] = await pool.query<RowDataPacket[]>(
      'SELECT IDMATRICULA, STATUSMATRICULA FROM TBLCDSMATR0 WHERE IDCURSO = ? AND IDPCD = ?',
      [idCurso, idPcd]
    );
  }

  if (!matricula || matricula['STATUSMATRICULA'] !== 'ATIVA') {
    throw new ErroApp(403, 'Matricule-se no curso para marcar a conclusão.');
  }

  await pool.execute(`UPDATE TBLCDSMATR0 SET DTCONCLUSAO = ${concluido ? 'NOW()' : 'NULL'} WHERE IDMATRICULA = ?`, [
    matricula['IDMATRICULA']
  ]);

  const [[atualizada]] = await pool.query<RowDataPacket[]>(
    'SELECT IDMATRICULA, STATUSMATRICULA, DTCAD, DTATIVACAO, DTCONCLUSAO FROM TBLCDSMATR0 WHERE IDMATRICULA = ?',
    [matricula['IDMATRICULA']]
  );
  return atualizada!;
}

/**
 * Quem se inscreveu no curso, para a empresa dona dele: dados do aluno,
 * situação da matrícula, último pagamento (quando o curso é pago) e se já
 * concluiu. Lança 404 se o curso não for da empresa.
 */
export async function listarInscritos(idCurso: number, idEmpresa: number): Promise<RowDataPacket[]> {
  const [cursos] = await pool.query<RowDataPacket[]>('SELECT IDCURSO FROM TBLCDSCURSO0 WHERE IDCURSO = ? AND IDEMPRESA = ?', [
    idCurso,
    idEmpresa
  ]);
  if (cursos.length === 0) {
    throw erroNaoEncontrado('Curso não encontrado.');
  }

  const [linhas] = await pool.query<RowDataPacket[]>(
    `SELECT m.IDMATRICULA, m.STATUSMATRICULA, m.VALOR, m.DTCAD, m.DTATIVACAO, m.DTCONCLUSAO,
            u.IDPCD, u.NOME, u.EMAIL,
            p.METODO, p.STATUSPAGAMENTO, p.PARCELAS, p.DTATUALIZACAO AS DTPAGAMENTO,
            (SELECT GROUP_CONCAT(n.DESCRICAO ORDER BY n.IDNECESSIDADE SEPARATOR '||')
               FROM TBLCDSMATRNEC0 n WHERE n.IDMATRICULA = m.IDMATRICULA) AS NECESSIDADES
     FROM TBLCDSMATR0 m
     INNER JOIN TBLCDSUSR0 u ON u.IDPCD = m.IDPCD
     LEFT JOIN TBLCDSPAG0 p ON p.IDPAGAMENTO = (
       -- Pagamento que importa: o aprovado, se houver; senão a tentativa mais recente.
       SELECT p2.IDPAGAMENTO FROM TBLCDSPAG0 p2 WHERE p2.IDMATRICULA = m.IDMATRICULA
       ORDER BY (p2.STATUSPAGAMENTO = 'APROVADO') DESC, p2.IDPAGAMENTO DESC LIMIT 1
     )
     WHERE m.IDCURSO = ?
     ORDER BY m.DTCAD DESC`,
    [idCurso]
  );

  return linhas;
}
