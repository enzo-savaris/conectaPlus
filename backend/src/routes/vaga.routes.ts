import { Router } from 'express';
import {
  atualizarVaga,
  cadastrarVaga,
  candidatarNaVaga,
  listarCandidaturasDaVaga,
  listarVagas,
  obterVaga,
  removerVaga
} from '../controller/vaga.controller.ts';

const rotasVaga = Router();

rotasVaga.post('/', cadastrarVaga);
rotasVaga.get('/', listarVagas);
rotasVaga.post('/:id/candidaturas', candidatarNaVaga);
rotasVaga.get('/:id/candidaturas', listarCandidaturasDaVaga);
rotasVaga.get('/:id', obterVaga);
rotasVaga.put('/:id', atualizarVaga);
rotasVaga.delete('/:id', removerVaga);

export default rotasVaga;
