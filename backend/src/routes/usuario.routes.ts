import { Router } from 'express';
import { uploadAvatarPcd, uploadPerfilPcd } from '../config/upload.ts';
import {
  atualizarUsuario,
  cadastrarUsuario,
  listarCandidaturasDoUsuario,
  listarUsuarios,
  obterCandidaturaDoUsuario,
  obterUsuario
} from '../controller/usuario.controller.ts';

const rotasUsuario = Router();

rotasUsuario.post('/', uploadAvatarPcd.single('avatar'), cadastrarUsuario);
rotasUsuario.get('/', listarUsuarios);
rotasUsuario.get('/:id/candidaturas', listarCandidaturasDoUsuario);
rotasUsuario.get('/:id/candidaturas/:idVaga', obterCandidaturaDoUsuario);
rotasUsuario.get('/:id', obterUsuario);
rotasUsuario.put('/:id', uploadPerfilPcd, atualizarUsuario);

export default rotasUsuario;
