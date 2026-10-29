import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';

import { PASTA_UPLOADS_AVATARES_PCD, PASTA_UPLOADS_CURRICULOS_PCD, PASTA_UPLOADS_CURSOS } from './config/upload.ts';
import { testarConexao } from './config/dataBase.ts';
import rotasAcessibilidade from './routes/acessibilidade.routes.ts';
import rotasAdmin from './routes/admin.routes.ts';
import rotasAuth from './routes/auth.routes.ts';
import rotasCandidatura from './routes/candidatura.routes.ts';
import rotasCidade from './routes/cidade.routes.ts';
import rotasCurso from './routes/curso.routes.ts';
import rotasEmpresa from './routes/empresa.routes.ts';
import rotasMatricula from './routes/matricula.routes.ts';
import rotasPagamento from './routes/pagamento.routes.ts';
import rotasUsuario from './routes/usuario.routes.ts';
import rotasVaga from './routes/vaga.routes.ts';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const api = express.Router();

// Rota raiz, útil para confirmar rapidamente que a API está no ar.
api.get('/', (_requisicao: Request, resposta: Response) => {
  resposta.json({ mensagem: 'API do Conecta+ funcionando' });
});

api.use('/acessibilidade', rotasAcessibilidade);
api.use('/admin', rotasAdmin);
api.use('/auth', rotasAuth);
api.use('/candidaturas', rotasCandidatura);
api.use('/cidades', rotasCidade);
api.use('/cursos', rotasCurso);
api.use('/empresas', rotasEmpresa);
api.use('/matriculas', rotasMatricula);
api.use('/pagamentos', rotasPagamento);
api.use('/usuarios', rotasUsuario);
api.use('/vagas', rotasVaga);

// Vídeos de curso enviados pela empresa (POST/PUT /cursos com arquivo anexado).
api.use('/uploads/cursos', express.static(PASTA_UPLOADS_CURSOS));

// Fotos de perfil enviadas no cadastro do candidato PCD.
api.use('/uploads/avatares', express.static(PASTA_UPLOADS_AVATARES_PCD));

// Currículos em PDF enviados pelo candidato PCD no perfil.
api.use('/uploads/curriculos', express.static(PASTA_UPLOADS_CURRICULOS_PCD));

// No servidor publicado (SERVIR_FRONTEND=true), a própria API serve o build
// do Angular e atende em /api, igual ao proxy do `ng serve`; assim frontend
// e backend ficam num endereço só. Em desenvolvimento, a API continua
// respondendo direto na raiz, atrás do proxy.
const PASTA_FRONTEND = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../frontend/dist/conectaPlus/browser'
);

if (process.env.SERVIR_FRONTEND === 'true') {
  if (!existsSync(path.join(PASTA_FRONTEND, 'index.html'))) {
    console.error(`SERVIR_FRONTEND=true, mas o build do frontend não existe em ${PASTA_FRONTEND}.`);
    process.exit(1);
  }

  app.use('/api', api);
  app.use(express.static(PASTA_FRONTEND));

  // Rotas do Angular (/painel, /vagas...): devolve o index.html e o
  // roteador do frontend decide a tela.
  app.get('/{*caminho}', (requisicao: Request, resposta: Response, proximo: NextFunction) => {
    if (requisicao.path.startsWith('/api/')) {
      proximo();
      return;
    }
    resposta.sendFile(path.join(PASTA_FRONTEND, 'index.html'));
  });
} else {
  app.use(api);
}

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
