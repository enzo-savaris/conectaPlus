import { Router } from 'express';
import {
  alterarStatusMembro,
  criarMembro,
  decidirEmpresa,
  entrarAdmin,
  listarEmpresasAdmin,
  listarEquipe,
  obterEmpresaAdmin
} from '../controller/admin.controller.ts';
import { autenticarAdmin } from '../middleware/autenticar-admin.ts';

const rotasAdmin = Router();

// Única rota aberta: o login da equipe.
rotasAdmin.post('/login', entrarAdmin);

// Todas as demais exigem o token de um membro ativo da equipe.
rotasAdmin.use(autenticarAdmin);
rotasAdmin.get('/empresas', listarEmpresasAdmin);
rotasAdmin.get('/empresas/:id', obterEmpresaAdmin);
rotasAdmin.put('/empresas/:id/decisao', decidirEmpresa);
rotasAdmin.get('/equipe', listarEquipe);
rotasAdmin.post('/equipe', criarMembro);
rotasAdmin.put('/equipe/:id/status', alterarStatusMembro);

export default rotasAdmin;
