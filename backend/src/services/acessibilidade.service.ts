import type { RowDataPacket } from 'mysql2/promise';
import pool from '../config/dataBase.ts';
import { erroDeValidacao, erroNaoEncontrado } from '../utils/erro-app.ts';

/**
 * Preferências de acessibilidade de cada conta (TBLCDSPREFACS0): cada
 * candidato e cada empresa tem as suas, independentes das de qualquer outra
 * pessoa que use o mesmo computador.
 */

/** Recursos aceitos — os mesmos cartões do painel de acessibilidade. */
const RECURSOS = [
  'navegacaoTeclado',
  'leitorTexto',
  'contrasteEscuro',
  'contrasteClaro',
  'lupa',
  'monocromatico',
  'tecladoVirtual',
  'ampliadorTexto',
  'destacarLinks',
  'destacarCabecalhos',
  'descricoesImagem'
] as const;

export type Preferencias = Record<(typeof RECURSOS)[number], boolean>;

/** De quem são as preferências: um candidato PCD ou uma empresa. */
export type DonoPreferencias =
  | { tipo: 'usuario'; id: number }
  | { tipo: 'empresa'; id: number }
  | { tipo: 'admin'; id: number };

const COLUNA_DO_DONO = { usuario: 'IDPCD', empresa: 'IDEMPRESA', admin: 'IDADMIN' } as const;
const TABELA_DO_DONO = { usuario: 'TBLCDSUSR0', empresa: 'TBLCDSEMP0', admin: 'TBLCDSADM0' } as const;

function coluna(dono: DonoPreferencias): 'IDPCD' | 'IDEMPRESA' | 'IDADMIN' {
  return COLUNA_DO_DONO[dono.tipo];
}

/** Só aceita os recursos conhecidos, com valor booleano; o que faltar fica desligado. */
export function validarPreferencias(valor: unknown): Preferencias {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    throw erroDeValidacao({ preferencias: 'Envie as preferências como um objeto.' });
  }

  const entrada = valor as Record<string, unknown>;
  const preferencias = {} as Preferencias;

  for (const recurso of RECURSOS) {
    preferencias[recurso] = entrada[recurso] === true;
  }

  // Os dois contrastes não combinam: se vierem os dois, vale o escuro.
  if (preferencias.contrasteEscuro && preferencias.contrasteClaro) {
    preferencias.contrasteClaro = false;
  }

  return preferencias;
}

async function confirmarConta(dono: DonoPreferencias): Promise<void> {
  const [linhas] = await pool.query<RowDataPacket[]>(
    `SELECT ${coluna(dono)} FROM ${TABELA_DO_DONO[dono.tipo]} WHERE ${coluna(dono)} = ?`,
    [dono.id]
  );

  if (linhas.length === 0) {
    throw erroNaoEncontrado('Conta não encontrada.');
  }
}

/** Preferências salvas da conta, ou `null` se ela ainda nunca salvou. */
export async function obter(dono: DonoPreferencias): Promise<Preferencias | null> {
  const [linhas] = await pool.query<RowDataPacket[]>(
    `SELECT PREFERENCIAS FROM TBLCDSPREFACS0 WHERE ${coluna(dono)} = ?`,
    [dono.id]
  );

  const bruto = linhas[0]?.['PREFERENCIAS'];
  if (bruto === undefined) {
    return null;
  }

  // O mysql2 devolve colunas JSON já convertidas; por garantia aceita texto também.
  return validarPreferencias(typeof bruto === 'string' ? JSON.parse(bruto) : bruto);
}

export async function salvar(dono: DonoPreferencias, preferencias: Preferencias): Promise<Preferencias> {
  await confirmarConta(dono);

  await pool.execute(
    `INSERT INTO TBLCDSPREFACS0 (${coluna(dono)}, PREFERENCIAS) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE PREFERENCIAS = VALUES(PREFERENCIAS)`,
    [dono.id, JSON.stringify(preferencias)]
  );

  return preferencias;
}
