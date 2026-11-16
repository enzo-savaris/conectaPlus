import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

import { FUSO_BRASILIA } from '../utils/fuso.ts';

dotenv.config();

/**
 * Lê uma variável do .env e falha logo na inicialização se ela não existir.
 * Sem isso, a conexão só quebraria na primeira consulta, com uma mensagem
 * bem menos clara.
 */
function variavelObrigatoria(nome: string): string {
  // trim(): um espaço colado sem querer no painel de hospedagem
  // ("DB_HOST= mysql-...") quebraria a resolução do endereço.
  const valor = process.env[nome]?.trim();

  if (!valor) {
    throw new Error(`A variável ${nome} não foi definida no arquivo .env`);
  }

  return valor;
}

/**
 * Pool de conexões reaproveitado por toda a aplicação. Abrir uma conexão por
 * requisição seria lento e esgotaria o limite de conexões do MySQL.
 */
const pool = mysql.createPool({
  host: variavelObrigatoria('DB_HOST'),
  // Porta do MySQL (3306 por padrão). Não confundir com PORT,
  // que é a porta em que a API escuta.
  port: Number(process.env.DB_PORT ?? 3306),
  user: variavelObrigatoria('DB_USER'),
  // A senha pode ser vazia em instalações locais do MySQL.
  password: process.env.DB_PASSWORD ?? '',
  database: variavelObrigatoria('DB_NAME'),
  // Bancos na nuvem (ex.: Aiven) só aceitam conexão criptografada. Com
  // DB_SSL=true liga o SSL; se DB_SSL_CA tiver o certificado do provedor,
  // o servidor também é verificado.
  ...(process.env.DB_SSL === 'true' && {
    ssl: process.env.DB_SSL_CA
      ? { ca: process.env.DB_SSL_CA.replace(/\\n/g, '\n') }
      : { rejectUnauthorized: false }
  }),
  // Datas sempre no horário de Brasília (utils/fuso.ts): `timezone` faz o
  // mysql2 ler e gravar DATETIME nesse fuso; o SET abaixo faz o NOW() e o
  // CURRENT_TIMESTAMP do MySQL também usarem.
  timezone: FUSO_BRASILIA,
  waitForConnections: true,
  connectionLimit: 10
});

pool.on('connection', (conexao) => {
  conexao.query(`SET time_zone = '${FUSO_BRASILIA}'`);
});

/** Confirma que o banco responde antes de o servidor começar a atender. */
export async function testarConexao(): Promise<void> {
  const conexao = await pool.getConnection();
  try {
    await conexao.ping();
  } finally {
    conexao.release();
  }
}

export default pool;
