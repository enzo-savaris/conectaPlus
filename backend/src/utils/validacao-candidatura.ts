import { erroDeValidacao } from './erro-app.ts';
import { validarId } from './validacao.ts';

/**
 * Validação do envio de uma candidatura. O corpo chega como
 * multipart/form-data (por causa do currículo em PDF opcional), então as
 * flags vêm como string ("true"/"false") e as respostas como uma string JSON.
 */

export const LIMITE_CARTA_APRESENTACAO = 500;
const LIMITE_RESPOSTA = 2000;

export interface RespostaPergunta {
  pergunta: string;
  resposta: string;
}

/** Candidatura já validada e pronta para gravar na TBLCDSCAND0 e na TBLCDSCANDRESP0. */
export interface DadosCandidatura {
  idPcd: number;
  cartaApresentacao: string | null;
  entrevistaRemota: boolean;
  tempoEstendido: boolean;
  interpreteLibras: boolean;
  inicioImediato: boolean;
  respostas: RespostaPergunta[];
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

function booleano(valor: unknown): boolean {
  return valor === true || valor === 'true' || valor === '1';
}

/** Respostas às perguntas da vaga; as que vierem vazias são descartadas. */
function listaDeRespostas(valor: unknown, erros: Record<string, string>): RespostaPergunta[] {
  let lista: unknown = valor;

  if (typeof valor === 'string') {
    try {
      lista = JSON.parse(valor);
    } catch {
      erros['respostas'] = 'Respostas inválidas: envie um JSON válido.';
      return [];
    }
  }

  if (!Array.isArray(lista)) {
    return [];
  }

  const respostas: RespostaPergunta[] = [];

  for (const item of lista) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }

    const entrada = item as Record<string, unknown>;
    const pergunta = texto(entrada['pergunta']);
    const resposta = texto(entrada['resposta']);

    if (pergunta === '' || resposta === '') {
      continue;
    }

    if (resposta.length > LIMITE_RESPOSTA) {
      erros['respostas'] = `Cada resposta deve ter no máximo ${LIMITE_RESPOSTA} caracteres.`;
    }

    respostas.push({ pergunta, resposta });
  }

  return respostas;
}

export function validarCandidatura(corpo: unknown): DadosCandidatura {
  if (typeof corpo !== 'object' || corpo === null) {
    throw erroDeValidacao({ corpo: 'Envie os dados da candidatura.' });
  }

  const entrada = corpo as Record<string, unknown>;
  const erros: Record<string, string> = {};

  const idPcd = validarId(entrada['idPcd']);

  if (!booleano(entrada['aceiteTermos'])) {
    erros['aceiteTermos'] = 'É preciso concordar com os termos e requisitos da vaga.';
  }

  const carta = texto(entrada['cartaApresentacao']);
  if (carta.length > LIMITE_CARTA_APRESENTACAO) {
    erros['cartaApresentacao'] = `A carta de apresentação deve ter no máximo ${LIMITE_CARTA_APRESENTACAO} caracteres.`;
  }

  const respostas = listaDeRespostas(entrada['respostas'], erros);

  if (Object.keys(erros).length > 0) {
    throw erroDeValidacao(erros);
  }

  return {
    idPcd,
    cartaApresentacao: carta === '' ? null : carta,
    entrevistaRemota: booleano(entrada['entrevistaRemota']),
    tempoEstendido: booleano(entrada['tempoEstendido']),
    interpreteLibras: booleano(entrada['interpreteLibras']),
    inicioImediato: booleano(entrada['inicioImediato']),
    respostas
  };
}
