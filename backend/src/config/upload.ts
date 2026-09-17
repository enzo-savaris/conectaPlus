import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';

const PASTA_UPLOADS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads/cursos');
const PASTA_UPLOADS_AVATARES = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../uploads/avatares'
);
const PASTA_UPLOADS_CURRICULOS = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../uploads/curriculos'
);

// O multer não cria a pasta de destino sozinho — sem isso, o primeiro upload
// em um ambiente novo (recém-clonado) falharia com ENOENT.
mkdirSync(PASTA_UPLOADS, { recursive: true });
mkdirSync(PASTA_UPLOADS_AVATARES, { recursive: true });
mkdirSync(PASTA_UPLOADS_CURRICULOS, { recursive: true });

function criarArmazenamento(pasta: string): multer.StorageEngine {
  return multer.diskStorage({
    destination: (_requisicao, _arquivo, callback) => callback(null, pasta),
    filename: (_requisicao, arquivo, callback) => {
      callback(null, `${randomUUID()}${path.extname(arquivo.originalname)}`);
    }
  });
}

const armazenamento = criarArmazenamento(PASTA_UPLOADS);

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

/** Aceita só imagem, para a foto de perfil do candidato PCD — é opcional, então isso só entra em ação quando alguém envia algo. */
function filtrarImagem(
  _requisicao: unknown,
  arquivo: Express.Multer.File,
  callback: multer.FileFilterCallback
): void {
  if (!arquivo.mimetype.startsWith('image/')) {
    callback(new Error('O arquivo enviado precisa ser uma imagem.'));
    return;
  }

  callback(null, true);
}

export const uploadAvatarPcd = multer({
  storage: criarArmazenamento(PASTA_UPLOADS_AVATARES),
  fileFilter: filtrarImagem,
  limits: { fileSize: 5 * 1024 * 1024 }
});

/**
 * Edição do perfil do candidato PCD: dois campos de arquivo na mesma
 * requisição — a foto de perfil (imagem) e o currículo em PDF, quando ele
 * escolhe anexar um em vez de montar o currículo pela plataforma. Cada um
 * vai pra sua pasta e só aceita o tipo certo, conforme o nome do campo.
 */
const armazenamentoPerfilPcd = multer.diskStorage({
  destination: (_requisicao, arquivo, callback) => {
    const pasta = arquivo.fieldname === 'curriculoPdf' ? PASTA_UPLOADS_CURRICULOS : PASTA_UPLOADS_AVATARES;
    callback(null, pasta);
  },
  filename: (_requisicao, arquivo, callback) => {
    callback(null, `${randomUUID()}${path.extname(arquivo.originalname)}`);
  }
});

function filtrarPerfilPcd(
  _requisicao: unknown,
  arquivo: Express.Multer.File,
  callback: multer.FileFilterCallback
): void {
  if (arquivo.fieldname === 'avatar' && !arquivo.mimetype.startsWith('image/')) {
    callback(new Error('A foto de perfil precisa ser uma imagem.'));
    return;
  }

  if (arquivo.fieldname === 'curriculoPdf' && arquivo.mimetype !== 'application/pdf') {
    callback(new Error('O currículo precisa ser um arquivo PDF.'));
    return;
  }

  callback(null, true);
}

export const uploadPerfilPcd = multer({
  storage: armazenamentoPerfilPcd,
  fileFilter: filtrarPerfilPcd,
  limits: { fileSize: 10 * 1024 * 1024 }
}).fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'curriculoPdf', maxCount: 1 }
]);

/** Usada pelo `server.ts` para servir os vídeos enviados como arquivos estáticos. */
export const PASTA_UPLOADS_CURSOS = PASTA_UPLOADS;

/** Usada pelo `server.ts` para servir as fotos de perfil enviadas como arquivos estáticos. */
export const PASTA_UPLOADS_AVATARES_PCD = PASTA_UPLOADS_AVATARES;

/** Usada pelo `server.ts` para servir os currículos em PDF enviados como arquivos estáticos. */
export const PASTA_UPLOADS_CURRICULOS_PCD = PASTA_UPLOADS_CURRICULOS;
