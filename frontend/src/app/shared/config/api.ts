/**
 * Endereço base da API do backend. Provisório até existir configuração de ambientes.
 *
 * No navegador, as chamadas vão para `/api` no mesmo endereço em que a página
 * foi aberta, e o proxy do `ng serve` (proxy.conf.json) repassa para o backend
 * em localhost:3000, tirando o prefixo `/api`. Assim funciona igual rodando
 * local, pelo IP da rede local ou por um túnel como o ngrok — quem acessa de
 * fora nunca precisa enxergar a porta 3000, só a do frontend.
 *
 * O prefixo existe porque o frontend tem rotas com o mesmo nome das da API
 * (/vagas, /cursos): sem ele, o proxy capturaria também as páginas.
 *
 * No SSR/prerender (onde `window` não existe) não há proxy no caminho, então
 * a chamada vai direto pro backend, que roda na mesma máquina.
 */
export const URL_BASE_API = typeof window !== 'undefined' ? '/api' : 'http://localhost:3000';
