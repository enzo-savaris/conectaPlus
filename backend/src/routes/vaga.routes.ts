import { Router } from 'express';
import { cadastrarVaga, listarVagas, removerVaga } from '../controller/vaga.controller.ts';

const rotasVaga = Router();

rotasVaga.post('/', cadastrarVaga);
rotasVaga.get('/', listarVagas);
rotasVaga.delete('/:id', removerVaga);

export default rotasVaga;
