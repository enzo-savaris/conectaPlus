import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';

import { PASTA_UPLOADS_CURSOS } from './config/upload.ts';
import { testarConexao } from './config/dataBase.ts';
import rotasAuth from './routes/auth.routes.ts';
import rotasCurso from './routes/curso.routes.ts';
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
app.use('/cursos', rotasCurso);
app.use('/empresas', rotasEmpresa);
app.use('/usuarios', rotasUsuario);
app.use('/vagas', rotasVaga);

// Vídeos de curso enviados pela empresa (POST/PUT /cursos com arquivo anexado).
app.use('/uploads/cursos', express.static(PASTA_UPLOADS_CURSOS));

// Qualquer caminho que não bata com as rotas acima.
app.use((requisicao: Request, resposta: Response) => {
  resposta.status(404).json({
    mensagem: `Rota não encontrada: ${requisicao.method} ${requisicao.originalUrl}`
  });
});

// Erros do multer (arquivo grande demais, tipo inválido) chegam aqui via
// `next(erro)` em vez do try/catch dos controllers — precisam de um handler
// de 4 parâmetros pro Express reconhecer como middleware de erro.
app.use((erro: unknown, _requisicao: Request, resposta: Response, _proximo: NextFunction) => {
  if (erro instanceof multer.MulterError || erro instanceof Error) {
    resposta.status(422).json({ mensagem: erro.message });
    return;
  }

  console.error(erro);
  resposta.status(500).json({ mensagem: 'Erro interno do servidor' });
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
