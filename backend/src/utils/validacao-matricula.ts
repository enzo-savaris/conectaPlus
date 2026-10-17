import { erroDeValidacao } from './erro-app.ts';
import { apenasDigitos, validarId } from './validacao.ts';

/** Matrícula: quem é o aluno e do que ele precisa para acompanhar o curso. */
export interface DadosMatricula {
  idPcd: number;
  necessidades: string[];
  observacao: string | null;
}

/**
 * Pagamento: Pix ou cartão. No cartão, o navegador já trocou os dados do
 * cartão por um `token` direto com o Mercado Pago — o número, a validade e
 * o CVV nunca chegam a este servidor.
 */
export type DadosPagamento =
  | { idPcd: number; metodo: 'PIX' }
  | {
      idPcd: number;
      metodo: 'CARTAO';
      token: string;
      bandeira: string;
      idEmissor: string | null;
      parcelas: number;
      email: string | null;
      documento: { tipo: string; numero: string } | null;
    };

export interface DadosAvaliacao {
  idPcd: number;
  nota: number;
  comentario: string | null;
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

function objeto(corpo: unknown, mensagem: string): Record<string, unknown> {
  if (typeof corpo !== 'object' || corpo === null) {
    throw erroDeValidacao({ corpo: mensagem });
  }
  return corpo as Record<string, unknown>;
}

export function validarMatricula(corpo: unknown): DadosMatricula {
  const entrada = objeto(corpo, 'Envie os dados da matrícula.');
  const erros: Record<string, string> = {};

  const idPcd = validarId(entrada['idPcd']);

  const necessidades = (Array.isArray(entrada['necessidades']) ? entrada['necessidades'] : [])
    .map((item) => texto(item))
    .filter((item) => item.length > 0);
  if (necessidades.length > 15 || necessidades.some((item) => item.length > 100)) {
    erros['necessidades'] = 'Lista de necessidades inválida.';
  }

  const observacao = texto(entrada['observacao']);
  if (observacao.length > 500) {
    erros['observacao'] = 'Use no máximo 500 caracteres.';
  }

  if (Object.keys(erros).length > 0) {
    throw erroDeValidacao(erros);
  }

  return { idPcd, necessidades, observacao: observacao === '' ? null : observacao };
}

export function validarPagamento(corpo: unknown): DadosPagamento {
  const entrada = objeto(corpo, 'Envie os dados do pagamento.');
  const idPcd = validarId(entrada['idPcd']);
  const metodo = texto(entrada['metodo']).toUpperCase();

  if (metodo === 'PIX') {
    return { idPcd, metodo: 'PIX' };
  }

  if (metodo !== 'CARTAO') {
    throw erroDeValidacao({ metodo: 'Escolha Pix ou cartão de crédito.' });
  }

  const erros: Record<string, string> = {};

  const token = texto(entrada['token']);
  if (!/^[A-Za-z0-9-]{10,}$/.test(token)) {
    erros['token'] = 'Os dados do cartão não foram validados. Confira e tente novamente.';
  }

  const bandeira = texto(entrada['bandeira']);
  if (!/^[a-z_]{2,30}$/.test(bandeira)) {
    erros['bandeira'] = 'Bandeira do cartão não identificada.';
  }

  const parcelas = Number(entrada['parcelas'] ?? 1);
  if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > 12) {
    erros['parcelas'] = 'Número de parcelas inválido.';
  }

  const idEmissor = texto(entrada['idEmissor']) || null;
  const email = texto(entrada['email']) || null;

  const tipoDocumento = texto(entrada['tipoDocumento']).toUpperCase();
  const numeroDocumento = apenasDigitos(texto(entrada['numeroDocumento']));
  const documento = tipoDocumento && numeroDocumento ? { tipo: tipoDocumento, numero: numeroDocumento } : null;

  if (Object.keys(erros).length > 0) {
    throw erroDeValidacao(erros);
  }

  return { idPcd, metodo: 'CARTAO', token, bandeira, idEmissor, parcelas, email, documento };
}

export function validarAvaliacao(corpo: unknown): DadosAvaliacao {
  const entrada = objeto(corpo, 'Envie a avaliação.');
  const erros: Record<string, string> = {};

  const idPcd = validarId(entrada['idPcd']);

  const nota = Number(entrada['nota']);
  if (!Number.isInteger(nota) || nota < 1 || nota > 5) {
    erros['nota'] = 'Escolha uma nota de 1 a 5 estrelas.';
  }

  const comentario = texto(entrada['comentario']);
  if (comentario.length > 500) {
    erros['comentario'] = 'O comentário deve ter no máximo 500 caracteres.';
  }

  if (Object.keys(erros).length > 0) {
    throw erroDeValidacao(erros);
  }

  return { idPcd, nota, comentario: comentario === '' ? null : comentario };
}
