import { Router } from 'express';
import {
  atualizarEmpresa,
  cadastrarEmpresa,
  listarCandidatosDaEmpresa,
  listarEmpresas,
  obterEmpresa,
  obterPainelEmpresa,
  obterSituacaoEmpresa,
  removerEmpresa
} from '../controller/empresa.controller.ts';

const rotasEmpresa = Router();

rotasEmpresa.post('/', cadastrarEmpresa);
rotasEmpresa.get('/', listarEmpresas);
// Antes de '/:id', senão "situacao" seria lido como id.
rotasEmpresa.get('/situacao', obterSituacaoEmpresa);
rotasEmpresa.get('/:id/painel', obterPainelEmpresa);
rotasEmpresa.get('/:id/candidatos', listarCandidatosDaEmpresa);
rotasEmpresa.get('/:id', obterEmpresa);
rotasEmpresa.put('/:id', atualizarEmpresa);
rotasEmpresa.delete('/:id', removerEmpresa);

export default rotasEmpresa;
