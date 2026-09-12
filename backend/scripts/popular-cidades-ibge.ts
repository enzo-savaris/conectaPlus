import type { ResultSetHeader } from 'mysql2';
import pool from '../src/config/dataBase.ts';

/**
 * Popula TBLCDSCID0 com todos os municípios do Brasil, usando a API pública
 * do IBGE (gratuita, sem chave, sem limite de uso conhecido).
 *
 * Hoje a tabela só cresce organicamente: uma cidade só é cadastrada quando
 * alguém digita um CEP que resolve pra ela (ViaCEP) numa vaga. Isso deixa o
 * combobox de cidade (cadastro de vaga, cadastro/perfil de empresa) vazio
 * pra qualquer cidade que ainda não tenha passado por ali. Rodar este script
 * uma vez preenche a tabela inteira de uma vez.
 *
 * Idempotente: a UNIQUE KEY (NOME, ESTADO) da tabela faz o `INSERT IGNORE`
 * pular qualquer cidade que já exista, então rodar de novo não duplica nada.
 *
 * Uso: npm run popular-cidades (a partir da pasta backend/)
 */

const URL_IBGE = 'https://servicodados.ibge.gov.br/api/v1/localidades/municipios';
const TAMANHO_DO_LOTE = 500;

interface MunicipioIbge {
  nome: string;
  microrregiao?: { mesorregiao?: { UF?: { sigla?: string } } };
  'regiao-imediata'?: { 'regiao-intermediaria'?: { UF?: { sigla?: string } } };
}

function extrairUf(municipio: MunicipioIbge): string | null {
  return (
    municipio.microrregiao?.mesorregiao?.UF?.sigla ??
    municipio['regiao-imediata']?.['regiao-intermediaria']?.UF?.sigla ??
    null
  );
}

async function buscarMunicipios(): Promise<{ nome: string; estado: string }[]> {
  const resposta = await fetch(URL_IBGE);

  if (!resposta.ok) {
    throw new Error(`IBGE respondeu ${resposta.status} ao listar municípios.`);
  }

  const municipios = (await resposta.json()) as MunicipioIbge[];

  return municipios
    .map((municipio) => ({ nome: municipio.nome, estado: extrairUf(municipio) }))
    .filter((municipio): municipio is { nome: string; estado: string } => municipio.estado !== null);
}

async function inserirEmLotes(cidades: { nome: string; estado: string }[]): Promise<number> {
  let totalInserido = 0;

  for (let inicio = 0; inicio < cidades.length; inicio += TAMANHO_DO_LOTE) {
    const lote = cidades.slice(inicio, inicio + TAMANHO_DO_LOTE);
    const valores = lote.map((cidade) => [cidade.nome, cidade.estado]);

    const [resultado] = await pool.query<ResultSetHeader>(
      'INSERT IGNORE INTO TBLCDSCID0 (NOME, ESTADO) VALUES ?',
      [valores]
    );

    totalInserido += resultado.affectedRows;
    console.log(`Lote ${inicio + 1}-${inicio + lote.length} de ${cidades.length} processado.`);
  }

  return totalInserido;
}

async function main(): Promise<void> {
  console.log('Buscando municípios na API do IBGE...');
  const cidades = await buscarMunicipios();
  console.log(`${cidades.length} municípios recebidos. Inserindo (ignorando os já cadastrados)...`);

  const totalInserido = await inserirEmLotes(cidades);

  console.log(`Concluído: ${totalInserido} cidades novas inseridas em TBLCDSCID0.`);
  await pool.end();
}

main().catch((erro) => {
  console.error('Falha ao popular cidades:', erro);
  process.exitCode = 1;
});
