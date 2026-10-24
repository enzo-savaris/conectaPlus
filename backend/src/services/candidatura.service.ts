import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import pool from '../config/dataBase.ts';
import { garantirEmpresaAtiva } from './empresa.service.ts';
import { listarRespostas } from './vaga.service.ts';
import { erroDeConflito, erroNaoEncontrado } from '../utils/erro-app.ts';
import type { DadosEtapaCandidatura } from '../utils/validacao-etapa-candidatura.ts';

/**
 * Processo seletivo de uma candidatura (TBLCDSCAND0), do ponto de vista da
 * empresa dona da vaga: consultar tudo que o candidato enviou e avançar as
 * etapas (análise → entrevista → contratação ou encerramento). Cada mudança
 * de etapa vira uma linha na TBLCDSCANDHIST0.
 */

/**
 * Colunas do processo seletivo, compartilhadas com a tela de acompanhamento
 * do candidato. DTINICIO sai formatada como texto porque é uma coluna DATE:
 * como objeto Date, o fuso horário poderia empurrar o dia pra trás.
 */
export const COLUNAS_PROCESSO = `c.STATUSCANDIDATURA, c.DTCAD AS DTCANDIDATURA,
  c.DTENTREVISTA, c.FORMATOENTREVISTA, c.LOCALENTREVISTA, c.OBSENTREVISTA,
  DATE_FORMAT(c.DTINICIO, '%Y-%m-%d') AS DTINICIO, c.MENSAGEMEMPRESA,
  c.COMPARECEU, c.PROPOSTASALARIO, c.PROPOSTADETALHES,
  DATE_FORMAT(c.PROPOSTAVALIDADE, '%Y-%m-%d') AS PROPOSTAVALIDADE,
  c.RESPOSTACANDIDATO, c.DTRESPOSTA,
  c.ENTREVISTAREMOTA, c.TEMPOESTENDIDO, c.INTERPRETELIBRAS, c.INICIOIMEDIATO`;

/**
 * De quais etapas cada ação pode partir. Reagendar continua possível depois
 * de registrar a entrevista (ex.: o candidato não compareceu), e a proposta
 * pode sair direto da análise quando a empresa dispensa a entrevista.
 */
const ETAPAS_DE_ORIGEM: Record<DadosEtapaCandidatura['acao'], string[]> = {
  INICIAR_ANALISE: ['PENDENTE'],
  AGENDAR_ENTREVISTA: ['EM_ANALISE', 'ENTREVISTA', 'ENTREVISTA_REALIZADA'],
  REGISTRAR_ENTREVISTA: ['ENTREVISTA'],
  ENVIAR_PROPOSTA: ['EM_ANALISE', 'ENTREVISTA_REALIZADA'],
  REPROVAR: ['PENDENTE', 'EM_ANALISE', 'ENTREVISTA', 'ENTREVISTA_REALIZADA', 'PROPOSTA']
};

/** Data/hora em que a candidatura entrou em cada etapa, na ordem em que aconteceu. */
export async function listarHistorico(idCandidatura: number): Promise<RowDataPacket[]> {
  const [linhas] = await pool.query<RowDataPacket[]>(
    `SELECT STATUSCANDIDATURA, DTCAD FROM TBLCDSCANDHIST0
     WHERE IDCANDIDATURA = ? ORDER BY DTCAD, IDHISTORICO`,
    [idCandidatura]
  );

  return linhas;
}

export async function registrarHistorico(
  conexao: PoolConnection,
  idCandidatura: number,
  status: string
): Promise<void> {
  await conexao.execute('INSERT INTO TBLCDSCANDHIST0 (IDCANDIDATURA, STATUSCANDIDATURA) VALUES (?, ?)', [
    idCandidatura,
    status
  ]);
}

/**
 * Candidatura completa para a tela de gestão da empresa. Lança 404 tanto se
 * o id não existir quanto se a vaga for de outra empresa — mesmo critério
 * das outras rotas da empresa, pra não revelar candidaturas alheias.
 */
export async function obterParaEmpresa(idCandidatura: number, idEmpresa: number): Promise<Record<string, unknown>> {
  const [linhas] = await pool.query<RowDataPacket[]>(
    `SELECT c.IDCANDIDATURA, c.IDVAGA, ${COLUNAS_PROCESSO}, c.NOTASENTREVISTA, c.CARTAAPRESENTACAO,
            COALESCE(c.CURRICULOPDF, u.CURRICULOPDF) AS CURRICULOPDF,
            v.TITULO, v.MODELOTRABALHO,
            u.IDPCD, u.NOME, u.EMAIL, u.TELEFONE, u.TIPODEF, u.CIDADE, u.ESTADO,
            u.AVATAR, u.TITULOPROFISSIONAL
     FROM TBLCDSCAND0 c
     INNER JOIN TBLCDSVAG0 v ON v.IDVAGA = c.IDVAGA
     INNER JOIN TBLCDSUSR0 u ON u.IDPCD = c.IDPCD
     WHERE c.IDCANDIDATURA = ? AND v.IDEMPRESA = ?`,
    [idCandidatura, idEmpresa]
  );

  const candidatura = linhas[0];
  if (!candidatura) {
    throw erroNaoEncontrado('Candidatura não encontrada.');
  }

  const [respostas, historico] = await Promise.all([
    listarRespostas([idCandidatura]),
    listarHistorico(idCandidatura)
  ]);

  return { ...candidatura, respostas: respostas.get(idCandidatura) ?? [], historico };
}

/**
 * Avança a candidatura para a etapa da ação informada, só se a vaga for da
 * empresa e se a etapa atual permitir (ex.: não dá pra agendar entrevista
 * de quem já foi contratado). Reagendar a entrevista só atualiza os dados
 * dela, sem gerar uma nova linha no histórico.
 */
export async function alterarEtapa(
  idCandidatura: number,
  dados: DadosEtapaCandidatura
): Promise<Record<string, unknown>> {
  await garantirEmpresaAtiva(dados.idEmpresa);

  const conexao = await pool.getConnection();

  try {
    await conexao.beginTransaction();

    const [linhas] = await conexao.query<RowDataPacket[]>(
      `SELECT c.STATUSCANDIDATURA FROM TBLCDSCAND0 c
       INNER JOIN TBLCDSVAG0 v ON v.IDVAGA = c.IDVAGA
       WHERE c.IDCANDIDATURA = ? AND v.IDEMPRESA = ?
       FOR UPDATE`,
      [idCandidatura, dados.idEmpresa]
    );

    const atual = linhas[0];
    if (!atual) {
      throw erroNaoEncontrado('Candidatura não encontrada.');
    }

    const statusAtual = atual['STATUSCANDIDATURA'] as string;
    if (!ETAPAS_DE_ORIGEM[dados.acao].includes(statusAtual)) {
      throw erroDeConflito('Essa ação não está disponível na etapa atual da candidatura.');
    }

    let novoStatus: string;

    switch (dados.acao) {
      case 'INICIAR_ANALISE':
        novoStatus = 'EM_ANALISE';
        await conexao.execute('UPDATE TBLCDSCAND0 SET STATUSCANDIDATURA = ? WHERE IDCANDIDATURA = ?', [
          novoStatus,
          idCandidatura
        ]);
        break;

      case 'AGENDAR_ENTREVISTA':
        novoStatus = 'ENTREVISTA';
        await conexao.execute(
          `UPDATE TBLCDSCAND0 SET STATUSCANDIDATURA = ?, DTENTREVISTA = ?, FORMATOENTREVISTA = ?,
             LOCALENTREVISTA = ?, OBSENTREVISTA = ?
           WHERE IDCANDIDATURA = ?`,
          [
            novoStatus,
            dados.entrevista.data,
            dados.entrevista.formato,
            dados.entrevista.local,
            dados.entrevista.observacoes,
            idCandidatura
          ]
        );
        break;

      case 'REGISTRAR_ENTREVISTA':
        novoStatus = 'ENTREVISTA_REALIZADA';
        await conexao.execute(
          'UPDATE TBLCDSCAND0 SET STATUSCANDIDATURA = ?, COMPARECEU = ?, NOTASENTREVISTA = ? WHERE IDCANDIDATURA = ?',
          [novoStatus, dados.compareceu, dados.notas, idCandidatura]
        );
        break;

      case 'ENVIAR_PROPOSTA':
        novoStatus = 'PROPOSTA';
        await conexao.execute(
          `UPDATE TBLCDSCAND0 SET STATUSCANDIDATURA = ?, PROPOSTASALARIO = ?, DTINICIO = ?, PROPOSTADETALHES = ?,
             PROPOSTAVALIDADE = ?, MENSAGEMEMPRESA = ?, RESPOSTACANDIDATO = NULL, DTRESPOSTA = NULL
           WHERE IDCANDIDATURA = ?`,
          [
            novoStatus,
            dados.proposta.salario,
            dados.proposta.dataInicio,
            dados.proposta.detalhes,
            dados.proposta.validade,
            dados.proposta.mensagem,
            idCandidatura
          ]
        );
        break;

      case 'REPROVAR':
        novoStatus = 'REPROVADO';
        await conexao.execute(
          'UPDATE TBLCDSCAND0 SET STATUSCANDIDATURA = ?, MENSAGEMEMPRESA = ? WHERE IDCANDIDATURA = ?',
          [novoStatus, dados.mensagem, idCandidatura]
        );
        break;
    }

    if (novoStatus !== statusAtual) {
      await registrarHistorico(conexao, idCandidatura, novoStatus);
    }

    await conexao.commit();
  } catch (erro) {
    await conexao.rollback();
    throw erro;
  } finally {
    conexao.release();
  }

  return obterParaEmpresa(idCandidatura, dados.idEmpresa);
}

/**
 * O candidato responde à proposta recebida pela plataforma: aceitar conclui
 * a contratação (APROVADO); recusar encerra o processo do lado dele (DESISTIU),
 * com o motivo, se quiser contar. Só vale enquanto a proposta está aberta e
 * dentro do prazo que a empresa deu.
 */
export async function responderProposta(
  idPcd: number,
  idVaga: number,
  resposta: { aceitar: boolean; motivo: string | null }
): Promise<void> {
  const conexao = await pool.getConnection();

  try {
    await conexao.beginTransaction();

    const [linhas] = await conexao.query<RowDataPacket[]>(
      `SELECT IDCANDIDATURA, STATUSCANDIDATURA, PROPOSTAVALIDADE < CURDATE() AS EXPIRADA
       FROM TBLCDSCAND0 WHERE IDPCD = ? AND IDVAGA = ? FOR UPDATE`,
      [idPcd, idVaga]
    );
    const candidatura = linhas[0];

    if (!candidatura) {
      throw erroNaoEncontrado('Candidatura não encontrada.');
    }
    if (candidatura['STATUSCANDIDATURA'] !== 'PROPOSTA') {
      throw erroDeConflito('Não há proposta aguardando a sua resposta.');
    }
    if (Number(candidatura['EXPIRADA']) === 1) {
      throw erroDeConflito('O prazo para responder esta proposta terminou. Fale com a empresa.');
    }

    const novoStatus = resposta.aceitar ? 'APROVADO' : 'DESISTIU';
    const idCandidatura = candidatura['IDCANDIDATURA'] as number;

    await conexao.execute(
      'UPDATE TBLCDSCAND0 SET STATUSCANDIDATURA = ?, RESPOSTACANDIDATO = ?, DTRESPOSTA = NOW() WHERE IDCANDIDATURA = ?',
      [novoStatus, resposta.aceitar ? null : resposta.motivo, idCandidatura]
    );
    await registrarHistorico(conexao, idCandidatura, novoStatus);

    await conexao.commit();
  } catch (erro) {
    await conexao.rollback();
    throw erro;
  } finally {
    conexao.release();
  }
}
