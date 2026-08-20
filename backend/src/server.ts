import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import { testarConexao } from './config/dataBase.ts';
import rotasAuth from './routes/auth.routes.ts';
import rotasEmpresa from './routes/empresa.routes.ts';
import rotasUsuario from './routes/usuario.routes.ts';
import rotasVaga from './routes/vaga.routes.ts';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Rota raiz, útil para confirmar rapidamente que a API está no ar.
app.get('/', (_requisicao: Request, resposta: Response) => {
  resposta.json({ mensagem: 'API do Conecta+ funcionando' });
});

app.use('/auth', rotasAuth);
app.use('/empresas', rotasEmpresa);
app.use('/usuarios', rotasUsuario);
app.use('/vagas', rotasVaga);

// Qualquer caminho que não bata com as rotas acima.
app.use((requisicao: Request, resposta: Response) => {
  resposta.status(404).json({
    mensagem: `Rota não encontrada: ${requisicao.method} ${requisicao.originalUrl}`
  });
});

const PORTA = process.env.PORT ?? 3000;

// Falhar aqui é melhor do que aceitar requisições e só descobrir
// que o banco está fora na primeira consulta.
try {
  await testarConexao();
} catch (erro) {
  console.error('Não foi possível conectar ao MySQL.');
  console.error(erro instanceof Error ? erro.message : erro);
  console.error('Confira as variáveis DB_* do arquivo .env e se o MySQL está em execução.');
  process.exit(1);
}

app.listen(PORTA, () => {
  console.log(`Servidor rodando em http://localhost:${PORTA}`);
});
