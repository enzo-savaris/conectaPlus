/**
 * Endereço base da API do backend. Provisório até existir configuração de ambientes.
 *
 * Usa o mesmo host com que a página foi carregada (em vez de "localhost" fixo) pra
 * funcionar tanto rodando local quanto quando alguém acessa pelo IP da rede local
 * (ex.: um colega abrindo http://192.168.0.10:4200 enquanto o backend roda na
 * mesma máquina) — pra essa pessoa, "localhost" apontaria pro computador dela,
 * não pro servidor. No SSR (onde `window` não existe), cai de volta pra
 * "localhost", porque a renderização roda na própria máquina do backend.
 */
const hostAtual = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const protocoloAtual = typeof window !== 'undefined' ? window.location.protocol : 'http:';

export const URL_BASE_API = `${protocoloAtual}//${hostAtual}:3000`;
