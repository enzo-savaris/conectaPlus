import { Router } from 'express';
import {
  atualizarEmpresa,
  cadastrarEmpresa,
  listarCandidatosDaEmpresa,
  listarEmpresas,
  obterEmpresa,
  obterPainelEmpresa,
  removerEmpresa
} from '../controller/empresa.controller.ts';

const rotasEmpresa = Router();

rotasEmpresa.post('/', cadastrarEmpresa);
rotasEmpresa.get('/', listarEmpresas);
rotasEmpresa.get('/:id/painel', obterPainelEmpresa);
rotasEmpresa.get('/:id/candidatos', listarCandidatosDaEmpresa);
rotasEmpresa.get('/:id', obterEmpresa);
rotasEmpresa.put('/:id', atualizarEmpresa);
rotasEmpresa.delete('/:id', removerEmpresa);

export default rotasEmpresa;
