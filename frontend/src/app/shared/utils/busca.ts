/**
 * Deixa o texto comparável numa busca: minúsculas, sem acentos/cedilha e sem
 * pontuação. Assim "tecnico" encontra "Técnico", "ti" encontra "T.I." e
 * "front end" encontra "Front-End".
 */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '');
}

/**
 * Busca tolerante usada nas listas de vagas e cursos: cada palavra digitada
 * precisa aparecer em algum dos campos, em qualquer ordem (ex.: "sao paulo
 * desenvolvedor" acha a vaga "Desenvolvedor" em "São Paulo"). Termo vazio
 * aceita tudo.
 */
export function correspondeBusca(campos: readonly (string | null | undefined)[], termo: string): boolean {
  const palavras = termo
    .split(/\s+/)
    .map(normalizar)
    .filter((palavra) => palavra !== '');

  if (palavras.length === 0) {
    return true;
  }

  const texto = campos
    .filter((campo): campo is string => !!campo)
    .map((campo) => normalizar(campo).replace(/\s+/g, ''))
    .join(' ');

  return palavras.every((palavra) => texto.includes(palavra));
}
