import { ESTADOS } from './validacao.ts';
import { erroDeValidacao } from './erro-app.ts';

/**
 * Validação dos dados de uma vaga. A tela de cadastro já valida os mesmos
 * campos, mas o servidor precisa repetir a checagem: nada impede alguém de
 * chamar a API direto pelo Insomnia, sem passar pelo formulário.
 */

const MODELOS_TRABALHO = ['PRESENCIAL', 'HIBRIDO', 'REMOTO'] as const;
const TIPOS_CONTRATACAO = ['CLT', 'PJ', 'ESTAGIO', 'TEMPORARIO', 'FREELANCER'] as const;

export type ModeloTrabalho = (typeof MODELOS_TRABALHO)[number];
export type TipoContratacao = (typeof TIPOS_CONTRATACAO)[number];

/** Vaga já validada e pronta para gravar na TBLCDSVAG0 e nas tabelas filhas. */
export interface DadosVaga {
  titulo: string;
  area: string | null;
  descricao: string;
  cidade: string | null;
  estado: string | null;
  modeloTrabalho: ModeloTrabalho;
  tipoContratacao: TipoContratacao;
  salarioMinimo: number | null;
  salarioMaximo: number | null;
  responsabilidades: string[];
  requisitos: string[];
  acessibilidade: string[];
  beneficios: string[];
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

function textoOuNulo(valor: unknown): string | null {
  const limpo = texto(valor);
  return limpo === '' ? null : limpo;
}

/** Cada item vira uma linha na tabela filha correspondente; itens vazios são descartados. */
function listaDeTextos(valor: unknown): string[] {
  if (!Array.isArray(valor)) {
    return [];
  }

  return valor.map((item) => texto(item)).filter((item) => item.length > 0);
}

/** Devolve o valor numérico, `null` quando não informado, e registra erro quando inválido. */
function validarSalario(
  valor: unknown,
  campo: string,
  erros: Record<string, string>
): number | null {
  if (valor === null || valor === undefined || valor === '') {
    return null;
  }

  const numero = Number(valor);

  if (!Number.isFinite(numero) || numero < 0) {
    erros[campo] = 'Informe um valor numérico válido e não negativo.';
    return null;
  }

  return numero;
}

/**
 * Valida o corpo da requisição e devolve os dados prontos para o banco.
 * Lança ErroApp (422) se algum campo estiver inválido.
 */
export function validarVaga(corpo: unknown): DadosVaga {
  if (typeof corpo !== 'object' || corpo === null) {
    throw erroDeValidacao({ corpo: 'Envie um objeto JSON com os dados da vaga.' });
  }

  const entrada = corpo as Record<string, unknown>;
  const erros: Record<string, string> = {};

  const titulo = texto(entrada['titulo']);
  if (titulo.length < 3) {
    erros['titulo'] = 'O título da vaga deve ter ao menos 3 caracteres.';
  } else if (titulo.length > 150) {
    erros['titulo'] = 'O título da vaga deve ter no máximo 150 caracteres.';
  }

  const area = textoOuNulo(entrada['area']);
  if (area !== null && area.length > 100) {
    erros['area'] = 'O nome da empresa deve ter no máximo 100 caracteres.';
  }

  const descricao = texto(entrada['descricao']);
  if (descricao.length < 10) {
    erros['descricao'] = 'Descreva a vaga com ao menos 10 caracteres.';
  }

  const cidade = textoOuNulo(entrada['cidade']);

  const estado = textoOuNulo(entrada['estado'])?.toUpperCase() ?? null;
  if (estado !== null && !ESTADOS.includes(estado)) {
    erros['estado'] = 'Selecione uma UF válida.';
  }

  const modeloTrabalho = texto(entrada['modeloTrabalho']).toUpperCase();
  if (!(MODELOS_TRABALHO as readonly string[]).includes(modeloTrabalho)) {
    erros['modeloTrabalho'] = 'Selecione um modelo de trabalho válido.';
  }

  const tipoContratacao = texto(entrada['tipoContratacao']).toUpperCase();
  if (!(TIPOS_CONTRATACAO as readonly string[]).includes(tipoContratacao)) {
    erros['tipoContratacao'] = 'Selecione um tipo de contratação válido.';
  }

  const salarioMinimo = validarSalario(entrada['salarioMinimo'], 'salarioMinimo', erros);
  const salarioMaximo = validarSalario(entrada['salarioMaximo'], 'salarioMaximo', erros);

  if (
    salarioMinimo !== null &&
    salarioMaximo !== null &&
    !erros['salarioMinimo'] &&
    !erros['salarioMaximo'] &&
    salarioMinimo > salarioMaximo
  ) {
    erros['salarioMaximo'] = 'O salário máximo deve ser maior ou igual ao mínimo.';
  }

  if (Object.keys(erros).length > 0) {
    throw erroDeValidacao(erros);
  }

  return {
    titulo,
    area,
    descricao,
    cidade,
    estado,
    modeloTrabalho: modeloTrabalho as ModeloTrabalho,
    tipoContratacao: tipoContratacao as TipoContratacao,
    salarioMinimo,
    salarioMaximo,
    responsabilidades: listaDeTextos(entrada['responsabilidades']),
    requisitos: listaDeTextos(entrada['requisitos']),
    acessibilidade: listaDeTextos(entrada['acessibilidade']),
    beneficios: listaDeTextos(entrada['beneficios'])
  };
}
