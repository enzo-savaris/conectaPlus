import { ESTADOS, apenasDigitos, cpfValido, emailValido } from './validacao.ts';
import { erroDeValidacao } from './erro-app.ts';

/**
 * Validação do cadastro do candidato PCD. A tela de cadastro já valida os
 * mesmos campos, mas o servidor precisa repetir a checagem: nada impede
 * alguém de chamar a API direto pelo Insomnia, sem passar pelo formulário.
 */

const TIPOS_DEFICIENCIA = ['FISICA', 'AUDITIVA', 'VISUAL', 'INTELECTUAL', 'MULTIPLA', 'OUTRA'] as const;

export type TipoDeficiencia = (typeof TIPOS_DEFICIENCIA)[number];

/** Candidato já validado e pronto para gravar na TBLCDSUSR0 e nas tabelas filhas. */
export interface DadosCandidato {
  nome: string;
  email: string;
  telefone: string;
  cpf: string;
  senha: string;
  tipoDeficiencia: TipoDeficiencia;
  recursos: string[];
  interesses: string[];
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

/**
 * Valida o corpo da requisição e devolve os dados prontos para o banco.
 * Lança ErroApp (422) se algum campo estiver inválido.
 */
export function validarCandidato(corpo: unknown): DadosCandidato {
  if (typeof corpo !== 'object' || corpo === null) {
    throw erroDeValidacao({ corpo: 'Envie os dados do candidato.' });
  }

  const entrada = corpo as Record<string, unknown>;
  const erros: Record<string, string> = {};

  const nome = texto(entrada['nome']);
  if (nome.length < 3) {
    erros['nome'] = 'O nome deve ter ao menos 3 caracteres.';
  } else if (nome.length > 150) {
    erros['nome'] = 'O nome deve ter no máximo 150 caracteres.';
  }

  const email = texto(entrada['email']).toLowerCase();
  if (!emailValido(email)) {
    erros['email'] = 'Informe um e-mail válido.';
  }

  const telefone = apenasDigitos(texto(entrada['telefone']));
  if (telefone.length !== 10 && telefone.length !== 11) {
    erros['telefone'] = 'Informe um telefone com DDD (10 ou 11 dígitos).';
  }

  const cpf = apenasDigitos(texto(entrada['cpf']));
  if (!cpfValido(cpf)) {
    erros['cpf'] = 'CPF inválido.';
  }

  const senha = typeof entrada['senha'] === 'string' ? entrada['senha'] : '';
  if (senha.length < 8) {
    erros['senha'] = 'A senha deve ter ao menos 8 caracteres.';
  }

  const tipoDeficiencia = texto(entrada['tipoDeficiencia']).toUpperCase();
  if (!(TIPOS_DEFICIENCIA as readonly string[]).includes(tipoDeficiencia)) {
    erros['tipoDeficiencia'] = 'Selecione o tipo de deficiência.';
  }

  if (Object.keys(erros).length > 0) {
    throw erroDeValidacao(erros);
  }

  return {
    nome,
    email,
    telefone,
    cpf,
    senha,
    tipoDeficiencia: tipoDeficiencia as TipoDeficiencia,
    recursos: listaDeTextos(entrada['recursos']),
    interesses: listaDeTextos(entrada['interesses'])
  };
}

const TIPOS_CURRICULO = ['PLATAFORMA', 'PDF'] as const;

export type TipoCurriculo = (typeof TIPOS_CURRICULO)[number];

export interface ExperienciaCandidato {
  cargo: string;
  empresa: string;
  periodo: string | null;
  descricao: string | null;
}

export interface FormacaoCandidato {
  curso: string;
  instituicao: string;
  periodo: string | null;
}

/**
 * Dados do perfil do candidato, todos opcionais — só os campos presentes no
 * corpo da requisição são validados e gravados, o que permite editar o
 * perfil aos poucos sem reenviar tudo.
 */
export interface DadosPerfilCandidato {
  nome?: string;
  email?: string;
  telefone?: string;
  senha?: string;
  tituloProfissional?: string | null;
  sobreMim?: string | null;
  cidade?: string | null;
  estado?: string | null;
  tipoDeficiencia?: TipoDeficiencia;
  recursos?: string[];
  interesses?: string[];
  tipoCurriculo?: TipoCurriculo;
  habilidades?: string[];
  experiencias?: ExperienciaCandidato[];
  formacoes?: FormacaoCandidato[];
}

/** Cada entrada incompleta (sem cargo ou empresa) é descartada, em vez de travar o salvamento inteiro. */
function listaDeExperiencias(valor: unknown): ExperienciaCandidato[] {
  if (!Array.isArray(valor)) {
    return [];
  }

  const resultado: ExperienciaCandidato[] = [];

  for (const item of valor) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }

    const registro = item as Record<string, unknown>;
    const cargo = texto(registro['cargo']);
    const empresa = texto(registro['empresa']);

    if (!cargo || !empresa) {
      continue;
    }

    resultado.push({
      cargo,
      empresa,
      periodo: textoOuNulo(registro['periodo']),
      descricao: textoOuNulo(registro['descricao'])
    });
  }

  return resultado;
}

/** Cada entrada incompleta (sem curso ou instituição) é descartada, em vez de travar o salvamento inteiro. */
function listaDeFormacoes(valor: unknown): FormacaoCandidato[] {
  if (!Array.isArray(valor)) {
    return [];
  }

  const resultado: FormacaoCandidato[] = [];

  for (const item of valor) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }

    const registro = item as Record<string, unknown>;
    const curso = texto(registro['curso']);
    const instituicao = texto(registro['instituicao']);

    if (!curso || !instituicao) {
      continue;
    }

    resultado.push({ curso, instituicao, periodo: textoOuNulo(registro['periodo']) });
  }

  return resultado;
}

/**
 * Valida os campos do perfil presentes no corpo da requisição. Lança ErroApp
 * (422) se algum deles estiver inválido; campos ausentes são simplesmente
 * ignorados (o PUT é parcial).
 */
export function validarPerfilCandidato(corpo: unknown): DadosPerfilCandidato {
  if (typeof corpo !== 'object' || corpo === null) {
    throw erroDeValidacao({ corpo: 'Envie os dados do perfil.' });
  }

  const entrada = corpo as Record<string, unknown>;
  const erros: Record<string, string> = {};
  const dados: DadosPerfilCandidato = {};

  if (entrada['nome'] !== undefined) {
    const nome = texto(entrada['nome']);
    if (nome.length < 3) {
      erros['nome'] = 'O nome deve ter ao menos 3 caracteres.';
    } else if (nome.length > 150) {
      erros['nome'] = 'O nome deve ter no máximo 150 caracteres.';
    } else {
      dados.nome = nome;
    }
  }

  if (entrada['email'] !== undefined) {
    const email = texto(entrada['email']).toLowerCase();
    if (!emailValido(email)) {
      erros['email'] = 'Informe um e-mail válido.';
    } else {
      dados.email = email;
    }
  }

  if (entrada['telefone'] !== undefined) {
    const telefone = apenasDigitos(texto(entrada['telefone']));
    if (telefone.length !== 10 && telefone.length !== 11) {
      erros['telefone'] = 'Informe um telefone com DDD (10 ou 11 dígitos).';
    } else {
      dados.telefone = telefone;
    }
  }

  if (entrada['senha'] !== undefined) {
    const senha = typeof entrada['senha'] === 'string' ? entrada['senha'] : '';
    if (senha.length > 0 && senha.length < 8) {
      erros['senha'] = 'A senha deve ter ao menos 8 caracteres.';
    } else if (senha.length > 0) {
      dados.senha = senha;
    }
  }

  if (entrada['tituloProfissional'] !== undefined) {
    const valor = textoOuNulo(entrada['tituloProfissional']);
    if (valor !== null && valor.length > 150) {
      erros['tituloProfissional'] = 'O título profissional deve ter no máximo 150 caracteres.';
    } else {
      dados.tituloProfissional = valor;
    }
  }

  if (entrada['sobreMim'] !== undefined) {
    dados.sobreMim = textoOuNulo(entrada['sobreMim']);
  }

  if (entrada['cidade'] !== undefined) {
    dados.cidade = textoOuNulo(entrada['cidade']);
  }

  if (entrada['estado'] !== undefined) {
    const valor = textoOuNulo(entrada['estado'])?.toUpperCase() ?? null;
    if (valor !== null && !ESTADOS.includes(valor)) {
      erros['estado'] = 'Selecione uma UF válida.';
    } else {
      dados.estado = valor;
    }
  }

  if (entrada['tipoDeficiencia'] !== undefined) {
    const tipoDeficiencia = texto(entrada['tipoDeficiencia']).toUpperCase();
    if (!(TIPOS_DEFICIENCIA as readonly string[]).includes(tipoDeficiencia)) {
      erros['tipoDeficiencia'] = 'Selecione o tipo de deficiência.';
    } else {
      dados.tipoDeficiencia = tipoDeficiencia as TipoDeficiencia;
    }
  }

  if (entrada['recursos'] !== undefined) {
    dados.recursos = listaDeTextos(entrada['recursos']);
  }

  if (entrada['interesses'] !== undefined) {
    dados.interesses = listaDeTextos(entrada['interesses']);
  }

  if (entrada['tipoCurriculo'] !== undefined) {
    const tipoCurriculo = texto(entrada['tipoCurriculo']).toUpperCase();
    if (!(TIPOS_CURRICULO as readonly string[]).includes(tipoCurriculo)) {
      erros['tipoCurriculo'] = 'Selecione como montar o currículo.';
    } else {
      dados.tipoCurriculo = tipoCurriculo as TipoCurriculo;
    }
  }

  if (entrada['habilidades'] !== undefined) {
    dados.habilidades = listaDeTextos(entrada['habilidades']);
  }

  if (entrada['experiencias'] !== undefined) {
    dados.experiencias = listaDeExperiencias(entrada['experiencias']);
  }

  if (entrada['formacoes'] !== undefined) {
    dados.formacoes = listaDeFormacoes(entrada['formacoes']);
  }

  if (Object.keys(erros).length > 0) {
    throw erroDeValidacao(erros);
  }

  if (Object.keys(dados).length === 0) {
    throw erroDeValidacao({ corpo: 'Envie ao menos um campo para atualizar.' });
  }

  return dados;
}
