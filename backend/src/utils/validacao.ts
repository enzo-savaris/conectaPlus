import { erroDeValidacao } from './erro-app.ts';

/**
 * Validação dos dados da empresa.
 *
 * A tela de cadastro já valida os mesmos campos, mas o servidor precisa
 * repetir a checagem: nada impede alguém de chamar a API direto pelo
 * Insomnia, sem passar pelo formulário.
 */

export function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

export function apenasCaracteresCnpj(valor: string): string {
  return valor.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Confere os dígitos verificadores do CNPJ pelo algoritmo alfanumérico da
 * Receita Federal, em que cada caractere entra na conta como (ASCII - 48).
 * Para CNPJs só de números o resultado é igual ao do cálculo tradicional.
 */
export function cnpjValido(valor: string): boolean {
  const cnpj = apenasCaracteresCnpj(valor);

  if (cnpj.length !== 14) {
    return false;
  }

  // Os dois dígitos verificadores são sempre numéricos.
  if (!/^\d{2}$/.test(cnpj.slice(12))) {
    return false;
  }

  // Sequências repetidas passam na conta, mas não existem na prática.
  if (/^(\w)\1{13}$/.test(cnpj)) {
    return false;
  }

  const digitoVerificador = (tamanho: number): number => {
    let peso = tamanho - 7;
    let soma = 0;

    for (let i = 0; i < tamanho; i++) {
      soma += (cnpj.charCodeAt(i) - 48) * peso--;
      if (peso < 2) {
        peso = 9;
      }
    }

    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  return digitoVerificador(12) === Number(cnpj[12]) && digitoVerificador(13) === Number(cnpj[13]);
}

export function emailValido(valor: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor);
}

export const ESTADOS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

export type StatusEmpresa = 'ATIVA' | 'INATIVA' | 'PENDENTE';

/** Empresa já validada e pronta para gravar na TBLCDSEMP0. */
export interface DadosEmpresa {
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  email: string | null;
  telefone: string | null;
  cep: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  senha: string;
  status: StatusEmpresa;
}

/** Na atualização todos os campos são opcionais. */
export type DadosEmpresaParciais = Partial<DadosEmpresa>;

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

function textoOuNulo(valor: unknown): string | null {
  const limpo = texto(valor);
  return limpo === '' ? null : limpo;
}

/**
 * A tela envia o status em minúsculas ('ativo'), mas a coluna STATUSEMP usa
 * o feminino em maiúsculas ('ATIVA'). Esta função faz a tradução.
 */
function converterStatus(valor: unknown): StatusEmpresa | null {
  const status = texto(valor).toUpperCase();

  if (status === 'ATIVO' || status === 'ATIVA') {
    return 'ATIVA';
  }

  if (status === 'INATIVO' || status === 'INATIVA') {
    return 'INATIVA';
  }

  if (status === 'PENDENTE') {
    return 'PENDENTE';
  }

  return null;
}

/**
 * Valida o corpo da requisição e devolve os dados prontos para o banco.
 * Lança ErroApp (422) se algum campo estiver inválido.
 *
 * Com `parcial: true` (usado no PUT) só os campos presentes no corpo são
 * validados, o que permite atualizar uma empresa sem reenviar tudo.
 */
export function validarEmpresa(corpo: unknown, parcial: false): DadosEmpresa;
export function validarEmpresa(corpo: unknown, parcial: true): DadosEmpresaParciais;
export function validarEmpresa(corpo: unknown, parcial: boolean): DadosEmpresaParciais {
  if (typeof corpo !== 'object' || corpo === null) {
    throw erroDeValidacao({ corpo: 'Envie um objeto JSON com os dados da empresa.' });
  }

  const entrada = corpo as Record<string, unknown>;
  const erros: Record<string, string> = {};
  const dados: DadosEmpresaParciais = {};

  const precisaValidar = (campo: string): boolean => !parcial || entrada[campo] !== undefined;

  // ---------- Campos obrigatórios no cadastro ----------

  if (precisaValidar('razaoSocial')) {
    const valor = texto(entrada['razaoSocial']);
    if (valor.length < 3) {
      erros['razaoSocial'] = 'A razão social deve ter ao menos 3 caracteres.';
    } else if (valor.length > 150) {
      erros['razaoSocial'] = 'A razão social deve ter no máximo 150 caracteres.';
    } else {
      dados.razaoSocial = valor;
    }
  }

  if (precisaValidar('cnpj')) {
    const valor = apenasCaracteresCnpj(texto(entrada['cnpj']));
    if (!cnpjValido(valor)) {
      erros['cnpj'] = 'CNPJ inválido.';
    } else {
      dados.cnpj = valor;
    }
  }

  if (precisaValidar('senha')) {
    const valor = typeof entrada['senha'] === 'string' ? entrada['senha'] : '';
    if (valor.length < 8) {
      erros['senha'] = 'A senha deve ter ao menos 8 caracteres.';
    } else {
      dados.senha = valor;
    }
  }

  // ---------- Campos opcionais ----------

  if (precisaValidar('nomeFantasia')) {
    const valor = textoOuNulo(entrada['nomeFantasia']);
    if (valor !== null && valor.length > 150) {
      erros['nomeFantasia'] = 'O nome fantasia deve ter no máximo 150 caracteres.';
    } else {
      dados.nomeFantasia = valor;
    }
  }

  if (precisaValidar('email')) {
    const valor = textoOuNulo(entrada['email'])?.toLowerCase() ?? null;
    if (valor !== null && !emailValido(valor)) {
      erros['email'] = 'Informe um e-mail válido.';
    } else {
      dados.email = valor;
    }
  }

  if (precisaValidar('telefone')) {
    const bruto = textoOuNulo(entrada['telefone']);
    if (bruto === null) {
      dados.telefone = null;
    } else {
      const digitos = apenasDigitos(bruto);
      if (digitos.length !== 10 && digitos.length !== 11) {
        erros['telefone'] = 'Informe um telefone com DDD (10 ou 11 dígitos).';
      } else {
        dados.telefone = digitos;
      }
    }
  }

  if (precisaValidar('cep')) {
    const bruto = textoOuNulo(entrada['cep']);
    if (bruto === null) {
      dados.cep = null;
    } else {
      const digitos = apenasDigitos(bruto);
      if (digitos.length !== 8) {
        erros['cep'] = 'O CEP deve ter 8 dígitos.';
      } else {
        dados.cep = digitos;
      }
    }
  }

  if (precisaValidar('numero')) {
    const valor = textoOuNulo(entrada['numero']);
    if (valor !== null && valor.length > 10) {
      erros['numero'] = 'O número deve ter no máximo 10 caracteres.';
    } else {
      dados.numero = valor;
    }
  }

  if (precisaValidar('complemento')) {
    dados.complemento = textoOuNulo(entrada['complemento']);
  }

  if (precisaValidar('bairro')) {
    dados.bairro = textoOuNulo(entrada['bairro']);
  }

  if (precisaValidar('cidade')) {
    dados.cidade = textoOuNulo(entrada['cidade']);
  }

  if (precisaValidar('estado')) {
    const valor = textoOuNulo(entrada['estado'])?.toUpperCase() ?? null;
    if (valor !== null && !ESTADOS.includes(valor)) {
      erros['estado'] = 'Selecione uma UF válida.';
    } else {
      dados.estado = valor;
    }
  }

  if (precisaValidar('status')) {
    if (!parcial) {
      // No cadastro, a empresa sempre nasce PENDENTE — quem confirma que ela
      // existe é a análise manual, não o próprio formulário de cadastro. Por
      // isso o status enviado no corpo é ignorado nessa hora.
      dados.status = 'PENDENTE';
    } else {
      const valor = converterStatus(entrada['status']);
      if (valor === null) {
        erros['status'] = "O status deve ser 'ativo', 'inativo' ou 'pendente'.";
      } else {
        dados.status = valor;
      }
    }
  }

  if (Object.keys(erros).length > 0) {
    throw erroDeValidacao(erros);
  }

  if (parcial && Object.keys(dados).length === 0) {
    throw erroDeValidacao({ corpo: 'Envie ao menos um campo para atualizar.' });
  }

  return dados;
}

/** Converte o id vindo da URL, recusando valores que não sejam inteiros positivos. */
export function validarId(valor: unknown): number {
  const id = Number(valor);

  if (!Number.isInteger(id) || id <= 0) {
    throw erroDeValidacao({ id: 'O id deve ser um número inteiro positivo.' });
  }

  return id;
}
