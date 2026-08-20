import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derivarChave = promisify(scrypt) as (
  senha: string,
  sal: Buffer,
  tamanho: number
) => Promise<Buffer>;

const TAMANHO_SAL = 16;
const TAMANHO_CHAVE = 64;

/**
 * Gera o hash da senha com scrypt, que é lento de propósito para encarecer
 * ataques de força bruta. O sal aleatório é guardado junto do hash, separado
 * por ':', para que senhas iguais gerem resultados diferentes.
 *
 * A senha em texto puro nunca deve ser gravada na coluna SENHA.
 */
export async function gerarHashSenha(senha: string): Promise<string> {
  const sal = randomBytes(TAMANHO_SAL);
  const chave = await derivarChave(senha, sal, TAMANHO_CHAVE);
  return `${sal.toString('hex')}:${chave.toString('hex')}`;
}

/** Confere a senha informada contra o hash guardado no banco. */
export async function senhaConfere(senha: string, hashGuardado: string): Promise<boolean> {
  const [salHex, chaveHex] = hashGuardado.split(':');

  if (!salHex || !chaveHex) {
    return false;
  }

  const chaveEsperada = Buffer.from(chaveHex, 'hex');
  const chaveInformada = await derivarChave(senha, Buffer.from(salHex, 'hex'), chaveEsperada.length);

  // Comparação de tempo constante, para não revelar o hash por medição de tempo.
  return timingSafeEqual(chaveEsperada, chaveInformada);
}
