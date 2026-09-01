import { Router } from 'express';
import { buscarCidadePorCep, listarCidades } from '../controller/cidade.controller.ts';

const rotasCidade = Router();

rotasCidade.get('/cep/:cep', buscarCidadePorCep);
rotasCidade.get('/', listarCidades);

export default rotasCidade;
