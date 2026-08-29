import type { RowDataPacket } from 'mysql2';
import pool from '../config/dataBase.ts';
import { erroDeAutenticacao, erroEmpresaPendente } from '../utils/erro-app.ts';
import { senhaConfere } from '../utils/senha.ts';

export interface PerfilUsuario {
  id: number;
  nome: string;
  email: string | null;
  cpf: string;
  status: string;
}

export interface PerfilEmpresa {
  id: number;
  razaoSocial: string;
  nomeFantasia: string | null;
  email: string | null;
  cnpj: string;
  status: string;
}

export type Sessao =
  | { ambiente: 'usuario'; perfil: PerfilUsuario }
  | { ambiente: 'empresa'; perfil: PerfilEmpresa };

async function autenticarUsuario(cpf: string, senha: string): Promise<Sessao> {
  const [linhas] = await pool.query<RowDataPacket[]>(
    'SELECT IDPCD, NOME, EMAIL, CPF, SENHA, STATUSPCD FROM TBLCDSUSR0 WHERE CPF = ?',
    [cpf]
  );

  const usuario = linhas[0];
  if (!usuario || !(await senhaConfere(senha, usuario['SENHA'] as string))) {
    throw erroDeAutenticacao();
  }

  return {
    ambiente: 'usuario',
    perfil: {
      id: usuario['IDPCD'] as number,
      nome: usuario['NOME'] as string,
      email: (usuario['EMAIL'] as string | null) ?? null,
      cpf: usuario['CPF'] as string,
      status: usuario['STATUSPCD'] as string
    }
  };
}

async function autenticarEmpresa(cnpj: string, senha: string): Promise<Sessao> {
  const [linhas] = await pool.query<RowDataPacket[]>(
    'SELECT IDEMPRESA, RAZAO, FANTASIA, EMAIL, CNPJ, SENHA, STATUSEMP FROM TBLCDSEMP0 WHERE CNPJ = ?',
    [cnpj]
  );

  const empresa = linhas[0];
  if (!empresa || !(await senhaConfere(senha, empresa['SENHA'] as string))) {
    throw erroDeAutenticacao();
  }

  if (empresa['STATUSEMP'] === 'PENDENTE') {
    throw erroEmpresaPendente();
  }

  return {
    ambiente: 'empresa',
    perfil: {
      id: empresa['IDEMPRESA'] as number,
      razaoSocial: empresa['RAZAO'] as string,
      nomeFantasia: (empresa['FANTASIA'] as string | null) ?? null,
      email: (empresa['EMAIL'] as string | null) ?? null,
      cnpj: empresa['CNPJ'] as string,
      status: empresa['STATUSEMP'] as string
    }
  };
}

/**
 * Autentica pelo documento informado: 11 dígitos é CPF (candidato PCD, que
 * cai no ambiente de usuário), 14 é CNPJ (empresa). Cada ambiente tem sua
 * própria tabela e sua própria senha.
 */
export async function autenticar(documento: string, senha: string): Promise<Sessao> {
  if (documento.length === 11) {
    return autenticarUsuario(documento, senha);
  }

  if (documento.length === 14) {
    return autenticarEmpresa(documento, senha);
  }

  throw erroDeAutenticacao();
}
