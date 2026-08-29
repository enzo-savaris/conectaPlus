import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';

const PASTA_UPLOADS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads/cursos');

const armazenamento = multer.diskStorage({
  destination: (_requisicao, _arquivo, callback) => callback(null, PASTA_UPLOADS),
  filename: (_requisicao, arquivo, callback) => {
    callback(null, `${randomUUID()}${path.extname(arquivo.originalname)}`);
  }
});

/**
 * Aceita só vídeo, para o campo de anexo do curso — o link externo cobre
 * qualquer outro tipo de material (PDF, apresentação, etc.).
 */
function filtrarVideo(
  _requisicao: unknown,
  arquivo: Express.Multer.File,
  callback: multer.FileFilterCallback
): void {
  if (!arquivo.mimetype.startsWith('video/')) {
    callback(new Error('O arquivo enviado precisa ser um vídeo.'));
    return;
  }

  callback(null, true);
}

export const uploadVideoCurso = multer({
  storage: armazenamento,
  fileFilter: filtrarVideo,
  limits: { fileSize: 200 * 1024 * 1024 }
});

/** Usada pelo `server.ts` para servir os vídeos enviados como arquivos estáticos. */
export const PASTA_UPLOADS_CURSOS = PASTA_UPLOADS;
