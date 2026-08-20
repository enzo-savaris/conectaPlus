import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Lê uma variável do .env e falha logo na inicialização se ela não existir.
 * Sem isso, a conexão só quebraria na primeira consulta, com uma mensagem
 * bem menos clara.
 */
function variavelObrigatoria(nome: string): string {
  const valor = process.env[nome];

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
  waitForConnections: true,
  connectionLimit: 10
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
