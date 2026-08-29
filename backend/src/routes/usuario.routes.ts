import { Router } from 'express';
import { listarCandidaturasDoUsuario, listarUsuarios } from '../controller/usuario.controller.ts';

const rotasUsuario = Router();

rotasUsuario.get('/', listarUsuarios);
rotasUsuario.get('/:id/candidaturas', listarCandidaturasDoUsuario);

export default rotasUsuario;
