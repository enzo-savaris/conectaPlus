import type { Request, Response } from 'express';
import * as usuarioService from '../services/usuario.service.ts';
import { ErroApp, erroDeValidacao } from '../utils/erro-app.ts';
import { validarId } from '../utils/validacao.ts';
import { validarCandidato, validarPerfilCandidato } from '../utils/validacao-candidato.ts';

/**
 * Traduz o erro em resposta HTTP. Erros previstos (ErroApp) viram o status
 * que a regra de negócio definiu; qualquer outro vira 500, sem expor
 * detalhes internos ao cliente.
 */
function responderErro(resposta: Response, erro: unknown, mensagemPadrao: string): void {
  if (erro instanceof ErroApp) {
    resposta.status(erro.status).json({
      mensagem: erro.message,
      ...(erro.erros ? { erros: erro.erros } : {})
    });
    return;
  }

  console.error(erro);
  resposta.status(500).json({ mensagem: mensagemPadrao });
}

/**
 * O corpo chega como multipart/form-data (por causa da foto), então as duas
 * listas de múltipla escolha vêm como uma string JSON em vez de um array de
 * verdade — aqui isso é desfeito antes de repassar pro validador.
 */
function listaDoCorpo(valor: unknown): unknown {
  if (typeof valor !== 'string') {
    return valor;
  }

  try {
    return JSON.parse(valor);
  } catch {
    throw erroDeValidacao({ corpo: 'Lista inválida: envie um JSON válido.' });
  }
}

/** POST /usuarios — cadastra um candidato PCD. */
export const cadastrarUsuario = async (requisicao: Request, resposta: Response): Promise<void> => {
  try {
    const corpo = requisicao.body as Record<string, unknown>;
    const dados = validarCandidato({
      ...corpo,
      recursos: listaDoCorpo(corpo['recursos']),
      interesses: listaDoCorpo(corpo['interesses'])
    });
    const usuario = await usuarioService.cadastrar(dados, requisicao.file?.filename ?? null);

    resposta.status(201).json(usuario);
  } catch (erro) {
    responderErro(resposta, erro, 'Erro ao cadastrar candidato');
  }
};

/**
 * GET /usuarios/:id — perfil completo do candidato. Sem `?idEmpresa=`, é o
 * próprio candidato vendo (ou editando) o seu perfil. Com `?idEmpresa=`, é a
 * empresa abrindo o perfil de alguém inscrito numa vaga dela — só é permitido
 * se essa candidatura realmente existir.
 */
export const obterUsuario = async (requisicao: Request, resposta: Response): Promise<void> => {
  try {
    const idPcd = validarId(requisicao.params['id']);
    const idEmpresaBruto = requisicao.query['idEmpresa'];

    if (idEmpresaBruto !== undefined) {
      const idEmpresa = validarId(idEmpresaBruto);
      await usuarioService.confirmarRelacionamento(idPcd, idEmpresa);
    }

    const usuario = await usuarioService.obterDetalhado(idPcd);

    resposta.json(usuario);
  } catch (erro) {
    responderErro(resposta, erro, 'Erro ao buscar candidato');
  }
};

/** PUT /usuarios/:id — atualiza o perfil do candidato (dados básicos, currículo, foto). */
export const atualizarUsuario = async (requisicao: Request, resposta: Response): Promise<void> => {
  try {
    const idPcd = validarId(requisicao.params['id']);
    const corpo = requisicao.body as Record<string, unknown>;
    const dados = validarPerfilCandidato({
      ...corpo,
      recursos: corpo['recursos'] !== undefined ? listaDoCorpo(corpo['recursos']) : undefined,
      interesses: corpo['interesses'] !== undefined ? listaDoCorpo(corpo['interesses']) : undefined,
      habilidades: corpo['habilidades'] !== undefined ? listaDoCorpo(corpo['habilidades']) : undefined,
      experiencias: corpo['experiencias'] !== undefined ? listaDoCorpo(corpo['experiencias']) : undefined,
      formacoes: corpo['formacoes'] !== undefined ? listaDoCorpo(corpo['formacoes']) : undefined
    });

    const arquivos = requisicao.files as Record<string, Express.Multer.File[]> | undefined;
    const novoAvatar = arquivos?.['avatar']?.[0]?.filename ?? null;
    const novoCurriculoPdf = arquivos?.['curriculoPdf']?.[0]?.filename ?? null;

    const usuario = await usuarioService.atualizar(idPcd, dados, novoAvatar, novoCurriculoPdf);

    resposta.json(usuario);
  } catch (erro) {
    responderErro(resposta, erro, 'Erro ao atualizar perfil do candidato');
  }
};

/** GET /usuarios — lista os candidatos PCD cadastrados. */
export const listarUsuarios = async (
  _requisicao: Request,
  resposta: Response
): Promise<void> => {
  try {
    const usuarios = await usuarioService.listar();

    resposta.json(usuarios);
  } catch (erro) {
    responderErro(resposta, erro, 'Erro ao buscar usuários');
  }
};

/** GET /usuarios/:id/candidaturas — lista as vagas em que o candidato já se candidatou. */
export const listarCandidaturasDoUsuario = async (
  requisicao: Request,
  resposta: Response
): Promise<void> => {
  try {
    const idPcd = validarId(requisicao.params['id']);
    const candidaturas = await usuarioService.listarCandidaturas(idPcd);

    resposta.json(candidaturas);
  } catch (erro) {
    responderErro(resposta, erro, 'Erro ao buscar candidaturas do usuário');
  }
};
