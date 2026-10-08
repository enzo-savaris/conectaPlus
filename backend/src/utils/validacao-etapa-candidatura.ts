import { erroDeValidacao } from './erro-app.ts';
import { validarId } from './validacao.ts';

/**
 * Validação das ações da empresa sobre uma candidatura (tela "Gerenciar
 * candidatura"). Cada ação leva a candidatura para uma etapa do processo:
 *
 * - INICIAR_ANALISE    → EM_ANALISE
 * - AGENDAR_ENTREVISTA → ENTREVISTA (também usada para reagendar)
 * - CONTRATAR          → APROVADO
 * - REPROVAR           → REPROVADO
 */

const ACOES = ['INICIAR_ANALISE', 'AGENDAR_ENTREVISTA', 'CONTRATAR', 'REPROVAR'] as const;
const FORMATOS_ENTREVISTA = ['REMOTA', 'PRESENCIAL'] as const;

export type AcaoCandidatura = (typeof ACOES)[number];
export type FormatoEntrevista = (typeof FORMATOS_ENTREVISTA)[number];

export interface DadosEntrevista {
  /** "AAAA-MM-DD HH:MM:00", no fuso de quem agendou — vai direto pra coluna DATETIME. */
  data: string;
  formato: FormatoEntrevista;
  local: string;
  observacoes: string | null;
}

export type DadosEtapaCandidatura =
  | { idEmpresa: number; acao: 'INICIAR_ANALISE' }
  | { idEmpresa: number; acao: 'AGENDAR_ENTREVISTA'; entrevista: DadosEntrevista }
  | { idEmpresa: number; acao: 'CONTRATAR'; dataInicio: string | null; mensagem: string | null }
  | { idEmpresa: number; acao: 'REPROVAR'; mensagem: string | null };

const LIMITE_MENSAGEM = 2000;

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

function textoOuNulo(valor: unknown): string | null {
  const limpo = texto(valor);
  return limpo === '' ? null : limpo;
}

function validarMensagem(valor: unknown, erros: Record<string, string>): string | null {
  const mensagem = textoOuNulo(valor);
  if (mensagem !== null && mensagem.length > LIMITE_MENSAGEM) {
    erros['mensagem'] = `A mensagem deve ter no máximo ${LIMITE_MENSAGEM} caracteres.`;
  }
  return mensagem;
}

/** Aceita o valor de um <input type="datetime-local"> ("AAAA-MM-DDTHH:MM"). */
function validarDataEntrevista(valor: unknown, erros: Record<string, string>): string {
  const bruto = texto(valor);
  const correspondencia = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(bruto);

  if (!correspondencia) {
    erros['dataEntrevista'] = 'Informe a data e o horário da entrevista.';
    return '';
  }

  const data = new Date(`${correspondencia[1]}T${correspondencia[2]}:00`);
  if (Number.isNaN(data.getTime())) {
    erros['dataEntrevista'] = 'Data da entrevista inválida.';
  } else if (data.getTime() < Date.now()) {
    erros['dataEntrevista'] = 'A entrevista precisa ser agendada para uma data futura.';
  }

  return `${correspondencia[1]} ${correspondencia[2]}:00`;
}

/** Aceita o valor de um <input type="date"> ("AAAA-MM-DD"); vazio vira `null`. */
function validarDataInicio(valor: unknown, erros: Record<string, string>): string | null {
  const bruto = texto(valor);
  if (bruto === '') {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(bruto) || Number.isNaN(new Date(`${bruto}T00:00:00`).getTime())) {
    erros['dataInicio'] = 'Data de início inválida.';
    return null;
  }

  return bruto;
}

export function validarEtapaCandidatura(corpo: unknown): DadosEtapaCandidatura {
  if (typeof corpo !== 'object' || corpo === null) {
    throw erroDeValidacao({ corpo: 'Envie os dados da etapa.' });
  }

  const entrada = corpo as Record<string, unknown>;
  const idEmpresa = validarId(entrada['idEmpresa']);
  const acao = texto(entrada['acao']).toUpperCase();
  const erros: Record<string, string> = {};

  if (!(ACOES as readonly string[]).includes(acao)) {
    throw erroDeValidacao({ acao: 'Ação inválida.' });
  }

  let dados: DadosEtapaCandidatura;

  switch (acao as AcaoCandidatura) {
    case 'INICIAR_ANALISE':
      dados = { idEmpresa, acao: 'INICIAR_ANALISE' };
      break;

    case 'AGENDAR_ENTREVISTA': {
      const data = validarDataEntrevista(entrada['dataEntrevista'], erros);

      const formato = texto(entrada['formatoEntrevista']).toUpperCase();
      if (!(FORMATOS_ENTREVISTA as readonly string[]).includes(formato)) {
        erros['formatoEntrevista'] = 'Escolha se a entrevista é remota ou presencial.';
      }

      const local = texto(entrada['localEntrevista']);
      if (local === '') {
        erros['localEntrevista'] =
          formato === 'PRESENCIAL' ? 'Informe o endereço da entrevista.' : 'Informe o link da chamada.';
      } else if (local.length > 500) {
        erros['localEntrevista'] = 'Use no máximo 500 caracteres.';
      }

      const observacoes = textoOuNulo(entrada['observacoesEntrevista']);
      if (observacoes !== null && observacoes.length > LIMITE_MENSAGEM) {
        erros['observacoesEntrevista'] = `As observações devem ter no máximo ${LIMITE_MENSAGEM} caracteres.`;
      }

      dados = {
        idEmpresa,
        acao: 'AGENDAR_ENTREVISTA',
        entrevista: { data, formato: formato as FormatoEntrevista, local, observacoes }
      };
      break;
    }

    case 'CONTRATAR':
      dados = {
        idEmpresa,
        acao: 'CONTRATAR',
        dataInicio: validarDataInicio(entrada['dataInicio'], erros),
        mensagem: validarMensagem(entrada['mensagem'], erros)
      };
      break;

    case 'REPROVAR':
      dados = { idEmpresa, acao: 'REPROVAR', mensagem: validarMensagem(entrada['mensagem'], erros) };
      break;
  }

  if (Object.keys(erros).length > 0) {
    throw erroDeValidacao(erros);
  }

  return dados;
}
