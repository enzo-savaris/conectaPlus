import { Router } from 'express';
import { uploadVideoCurso } from '../config/upload.ts';
import {
  atualizarCurso,
  cadastrarCurso,
  listarCursos,
  obterCurso
} from '../controller/curso.controller.ts';

const rotasCurso = Router();

rotasCurso.post('/', uploadVideoCurso.single('arquivo'), cadastrarCurso);
rotasCurso.get('/', listarCursos);
rotasCurso.get('/:id', obterCurso);
rotasCurso.put('/:id', uploadVideoCurso.single('arquivo'), atualizarCurso);

export default rotasCurso;
