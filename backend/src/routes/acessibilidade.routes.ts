import { Router } from 'express';
import { obterPreferencias, salvarPreferencias } from '../controller/acessibilidade.controller.ts';

const rotasAcessibilidade = Router();

rotasAcessibilidade.get('/', obterPreferencias);
rotasAcessibilidade.put('/', salvarPreferencias);

export default rotasAcessibilidade;
