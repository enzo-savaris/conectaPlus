/**
 * Cria (ou reativa, trocando a senha) um membro da equipe Conecta+ pelo terminal.
 * Use para o PRIMEIRO acesso; depois, os demais são adicionados pela tela Equipe.
 *
 *   npm run criar-admin -- "Seu Nome" seu@email.com "SenhaForte123"
 */
import dotenv from 'dotenv';
dotenv.config({ quiet: true });

const { default: pool } = await import('../src/config/dataBase.ts');
const { gerarHashSenha } = await import('../src/utils/senha.ts');

const [nome, emailBruto, senha] = process.argv.slice(2);
const email = (emailBruto ?? '').trim().toLowerCase();

if (!nome || nome.trim().length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !senha || senha.length < 8) {
  console.error('Uso: npm run criar-admin -- "Nome completo" email@exemplo.com "senha com 8+ caracteres"');
  process.exit(1);
}

const hash = await gerarHashSenha(senha);
await pool.execute(
  `INSERT INTO TBLCDSADM0 (NOME, EMAIL, SENHA, STATUSADM) VALUES (?, ?, ?, 'ATIVO')
   ON DUPLICATE KEY UPDATE NOME = VALUES(NOME), SENHA = VALUES(SENHA), STATUSADM = 'ATIVO'`,
  [nome.trim(), email, hash]
);

console.log(`Acesso da equipe pronto para ${email}. Entre em /admin/login.`);
await pool.end();
