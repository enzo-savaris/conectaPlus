import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Token de sessão assinado pelo servidor (mesmo formato de um JWT HS256,
 * sem dependência externa): "cabeçalho.dados.assinatura", em base64url.
 *
 * A assinatura usa o segredo TOKEN_SECRET do .env: o navegador consegue ler
 * os dados, mas não consegue alterá-los (ex.: trocar o id do admin) sem
 * invalidar a assinatura. É isso que impede alguém de se passar por um
 * membro da equipe só mudando um id na requisição.
 */

export interface DadosToken {
  /** Tipo de conta e id dela. */
  sub: string;
  /** Expiração, em segundos desde 1970. */
  exp: number;
}

function segredo(): string {
  const valor = process.env['TOKEN_SECRET'];
  if (!valor || valor.length < 32) {
    throw new Error('TOKEN_SECRET ausente ou curto demais no .env (mínimo 32 caracteres).');
  }
  return valor;
}

const base64url = (texto: string | Buffer) => Buffer.from(texto).toString('base64url');

function assinar(conteudo: string): string {
  return createHmac('sha256', segredo()).update(conteudo).digest('base64url');
}

export function gerarToken(sub: string, validadeSegundos: number): string {
  const cabecalho = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const dados = base64url(JSON.stringify({ sub, exp: Math.floor(Date.now() / 1000) + validadeSegundos }));
  return `${cabecalho}.${dados}.${assinar(`${cabecalho}.${dados}`)}`;
}

/** Devolve os dados do token se a assinatura confere e ele não expirou; senão `null`. */
export function verificarToken(token: string): DadosToken | null {
  const partes = token.split('.');
  if (partes.length !== 3) {
    return null;
  }

  const [cabecalho, dados, assinatura] = partes as [string, string, string];
  const esperada = assinar(`${cabecalho}.${dados}`);

  if (esperada.length !== assinatura.length || !timingSafeEqual(Buffer.from(esperada), Buffer.from(assinatura))) {
    return null;
  }

  try {
    const conteudo = JSON.parse(Buffer.from(dados, 'base64url').toString('utf8')) as DadosToken;
    if (typeof conteudo.sub !== 'string' || typeof conteudo.exp !== 'number') {
      return null;
    }
    return conteudo.exp > Date.now() / 1000 ? conteudo : null;
  } catch {
    return null;
  }
}
