import { erroDeValidacao } from './erro-app.ts';
import { validarId } from './validacao.ts';

/**
 * Validação das ações da empresa sobre uma candidatura (tela "Gerenciar
 * candidatura"). Cada ação leva a candidatura para uma etapa do processo:
 *
 * - INICIAR_ANALISE      → EM_ANALISE
 * - AGENDAR_ENTREVISTA   → ENTREVISTA (também usada para reagendar)
 * - REGISTRAR_ENTREVISTA → ENTREVISTA_REALIZADA (como foi; anotações internas)
 * - ENVIAR_PROPOSTA      → PROPOSTA (o candidato aceita ou recusa pela plataforma)
 * - REPROVAR             → REPROVADO
 *
 * A contratação (APROVADO) acontece quando o candidato aceita a proposta.
 */

const ACOES = ['INICIAR_ANALISE', 'AGENDAR_ENTREVISTA', 'REGISTRAR_ENTREVISTA', 'ENVIAR_PROPOSTA', 'REPROVAR'] as const;
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

export interface DadosProposta {
  salario: number | null;
  /** "AAAA-MM-DD" */
  dataInicio: string;
  detalhes: string;
  /** Até quando o candidato pode aceitar ("AAAA-MM-DD"); `null` = sem prazo. */
  validade: string | null;
  mensagem: string | null;
}

export type DadosEtapaCandidatura =
  | { idEmpresa: number; acao: 'INICIAR_ANALISE' }
  | { idEmpresa: number; acao: 'AGENDAR_ENTREVISTA'; entrevista: DadosEntrevista }
  | { idEmpresa: number; acao: 'REGISTRAR_ENTREVISTA'; compareceu: boolean; notas: string | null }
  | { idEmpresa: number; acao: 'ENVIAR_PROPOSTA'; proposta: DadosProposta }
  | { idEmpresa: number; acao: 'REPROVAR'; mensagem: string | null };

/** Resposta do candidato à proposta recebida. */
export interface RespostaProposta {
  aceitar: boolean;
  motivo: string | null;
}

const LIMITE_MENSAGEM = 2000;

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

function textoOuNulo(valor: unknown): string | null {
  const limpo = texto(valor);
  return limpo === '' ? null : limpo;
}

function textoLimitado(valor: unknown, campo: string, erros: Record<string, string>): string | null {
  const limpo = textoOuNulo(valor);
  if (limpo !== null && limpo.length > LIMITE_MENSAGEM) {
    erros[campo] = `Use no máximo ${LIMITE_MENSAGEM} caracteres.`;
  }
  return limpo;
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
function validarData(valor: unknown, campo: string, erros: Record<string, string>): string | null {
  const bruto = texto(valor);
  if (bruto === '') {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(bruto) || Number.isNaN(new Date(`${bruto}T00:00:00`).getTime())) {
    erros[campo] = 'Data inválida.';
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

      dados = {
        idEmpresa,
        acao: 'AGENDAR_ENTREVISTA',
        entrevista: {
          data,
          formato: formato as FormatoEntrevista,
          local,
          observacoes: textoLimitado(entrada['observacoesEntrevista'], 'observacoesEntrevista', erros)
        }
      };
      break;
    }

    case 'REGISTRAR_ENTREVISTA':
      dados = {
        idEmpresa,
        acao: 'REGISTRAR_ENTREVISTA',
        compareceu: entrada['compareceu'] !== false,
        notas: textoLimitado(entrada['notas'], 'notas', erros)
      };
      break;

    case 'ENVIAR_PROPOSTA': {
      let salario: number | null = null;
      if (entrada['salario'] !== null && entrada['salario'] !== undefined && entrada['salario'] !== '') {
        salario = Number(entrada['salario']);
        if (!Number.isFinite(salario) || salario <= 0) {
          erros['salario'] = 'Informe um salário válido (ou deixe em branco).';
        }
      }

      const dataInicio = validarData(entrada['dataInicio'], 'dataInicio', erros);
      if (dataInicio === null && !erros['dataInicio']) {
        erros['dataInicio'] = 'Informe a data prevista de início.';
      }

      const detalhes = textoLimitado(entrada['detalhes'], 'detalhes', erros);
      if (!detalhes) {
        erros['detalhes'] = 'Descreva a proposta (cargo, jornada, benefícios…).';
      }

      const validade = validarData(entrada['validade'], 'validade', erros);
      const hoje = new Date().toISOString().slice(0, 10);
      if (validade !== null && validade < hoje) {
        erros['validade'] = 'O prazo para resposta não pode estar no passado.';
      }

      dados = {
        idEmpresa,
        acao: 'ENVIAR_PROPOSTA',
        proposta: {
          salario,
          dataInicio: dataInicio ?? '',
          detalhes: detalhes ?? '',
          validade,
          mensagem: textoLimitado(entrada['mensagem'], 'mensagem', erros)
        }
      };
      break;
    }

    case 'REPROVAR':
      dados = { idEmpresa, acao: 'REPROVAR', mensagem: textoLimitado(entrada['mensagem'], 'mensagem', erros) };
      break;
  }

  if (Object.keys(erros).length > 0) {
    throw erroDeValidacao(erros);
  }

  return dados;
}

export function validarRespostaProposta(corpo: unknown): RespostaProposta {
  const entrada = (typeof corpo === 'object' && corpo !== null ? corpo : {}) as Record<string, unknown>;
  const erros: Record<string, string> = {};

  if (typeof entrada['aceitar'] !== 'boolean') {
    throw erroDeValidacao({ aceitar: 'Informe se aceita ou recusa a proposta.' });
  }

  const motivo = textoLimitado(entrada['motivo'], 'motivo', erros);
  if (Object.keys(erros).length > 0) {
    throw erroDeValidacao(erros);
  }

  return { aceitar: entrada['aceitar'], motivo };
}
