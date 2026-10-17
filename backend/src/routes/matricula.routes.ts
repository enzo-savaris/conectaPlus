import { Router } from 'express';
import { consultarPagamentoDaMatricula, pagarMatricula } from '../controller/matricula.controller.ts';

const rotasMatricula = Router();

rotasMatricula.post('/:id/pagamentos', pagarMatricula);
rotasMatricula.get('/:id/pagamentos/ultimo', consultarPagamentoDaMatricula);

export default rotasMatricula;
