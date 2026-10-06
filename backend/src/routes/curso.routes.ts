import { Router } from 'express';
import { uploadVideoCurso } from '../config/upload.ts';
import {
  atualizarCurso,
  cadastrarCurso,
  listarCursos,
  obterCurso
} from '../controller/curso.controller.ts';

const rotasCurso = Router();

// .any() em vez de .single(): cada capítulo ARQUIVO manda seu próprio vídeo,
// num campo nomeado "modulo_<i>_capitulo_<j>" — a quantidade é dinâmica.
rotasCurso.post('/', uploadVideoCurso.any(), cadastrarCurso);
rotasCurso.get('/', listarCursos);
rotasCurso.get('/:id', obterCurso);
rotasCurso.put('/:id', uploadVideoCurso.any(), atualizarCurso);

export default rotasCurso;
