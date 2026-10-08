import { Router } from 'express';
import { alterarEtapaCandidatura, obterCandidatura } from '../controller/candidatura.controller.ts';

const rotasCandidatura = Router();

rotasCandidatura.get('/:id', obterCandidatura);
rotasCandidatura.put('/:id/etapa', alterarEtapaCandidatura);

export default rotasCandidatura;
