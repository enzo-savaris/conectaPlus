import { Router } from 'express';
import { listarUsuarios } from '../controller/usuario.controller.ts';

const rotasUsuario = Router();

rotasUsuario.get('/', listarUsuarios);

export default rotasUsuario;
