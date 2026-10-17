import type { Request, Response } from 'express';
import * as adminService from '../services/admin.service.ts';
import type { AcaoEmpresa, StatusEmpresa } from '../services/admin.service.ts';
import { ErroApp, erroDeValidacao } from '../utils/erro-app.ts';
import { validarId } from '../utils/validacao.ts';

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

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATUS: StatusEmpresa[] = ['PENDENTE', 'ATIVA', 'INATIVA', 'RECUSADA'];
const ACOES: AcaoEmpresa[] = ['APROVAR', 'RECUSAR', 'INATIVAR'];

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

/** POST /admin/login — e-mail e senha de um membro da equipe; devolve a sessão com o token. */
export const entrarAdmin = async (requisicao: Request, resposta: Response): Promise<void> => {
  try {
    const corpo = (requisicao.body ?? {}) as Record<string, unknown>;
    const email = texto(corpo['email']).toLowerCase();
    const senha = typeof corpo['senha'] === 'string' ? corpo['senha'] : '';

    if (!REGEX_EMAIL.test(email) || !senha) {
      throw erroDeValidacao({ login: 'Informe e-mail e senha.' });
    }

    resposta.json(await adminService.autenticar(email, senha));
  } catch (erro) {
    responderErro(resposta, erro, 'Erro ao entrar');
  }
};

/** GET /admin/empresas?status=PENDENTE&busca= — fila de validação + contagem por status. */
export const listarEmpresasAdmin = async (requisicao: Request, resposta: Response): Promise<void> => {
  try {
    const status = texto(requisicao.query['status']).toUpperCase() as StatusEmpresa;
    if (!STATUS.includes(status)) {
      throw erroDeValidacao({ status: 'Status inválido.' });
    }

    const [empresas, contagem] = await Promise.all([
      adminService.listarEmpresas(status, texto(requisicao.query['busca']).slice(0, 100)),
      adminService.contarEmpresas()
    ]);

    resposta.json({ empresas, contagem });
  } catch (erro) {
    responderErro(resposta, erro, 'Erro ao buscar empresas');
  }
};

/** GET /admin/empresas/:id — todos os dados da empresa para a análise. */
export const obterEmpresaAdmin = async (requisicao: Request, resposta: Response): Promise<void> => {
  try {
    resposta.json(await adminService.obterEmpresa(validarId(requisicao.params['id'])));
  } catch (erro) {
    responderErro(resposta, erro, 'Erro ao buscar empresa');
  }
};

/** PUT /admin/empresas/:id/decisao — { acao: APROVAR | RECUSAR | INATIVAR, motivo }. */
export const decidirEmpresa = async (requisicao: Request, resposta: Response): Promise<void> => {
  try {
    const corpo = (requisicao.body ?? {}) as Record<string, unknown>;
    const acao = texto(corpo['acao']).toUpperCase() as AcaoEmpresa;
    if (!ACOES.includes(acao)) {
      throw erroDeValidacao({ acao: 'Ação inválida.' });
    }

    const motivo = texto(corpo['motivo']);
    if (motivo.length > 500) {
      throw erroDeValidacao({ motivo: 'Use no máximo 500 caracteres.' });
    }

    const empresa = await adminService.decidir(
      validarId(requisicao.params['id']),
      acao,
      motivo || null,
      requisicao.admin!.id
    );

    resposta.json(empresa);
  } catch (erro) {
    responderErro(resposta, erro, 'Erro ao registrar a decisão');
  }
};

/** GET /admin/equipe */
export const listarEquipe = async (_requisicao: Request, resposta: Response): Promise<void> => {
  try {
    resposta.json(await adminService.listarEquipe());
  } catch (erro) {
    responderErro(resposta, erro, 'Erro ao buscar a equipe');
  }
};

/** POST /admin/equipe — { nome, email, senha } cria o acesso de um novo membro. */
export const criarMembro = async (requisicao: Request, resposta: Response): Promise<void> => {
  try {
    const corpo = (requisicao.body ?? {}) as Record<string, unknown>;
    const nome = texto(corpo['nome']);
    const email = texto(corpo['email']).toLowerCase();
    const senha = typeof corpo['senha'] === 'string' ? corpo['senha'] : '';
    const erros: Record<string, string> = {};

    if (nome.length < 3) erros['nome'] = 'Informe o nome (mínimo 3 caracteres).';
    if (!REGEX_EMAIL.test(email)) erros['email'] = 'Informe um e-mail válido.';
    if (senha.length < 8) erros['senha'] = 'A senha precisa ter ao menos 8 caracteres.';
    if (Object.keys(erros).length > 0) {
      throw erroDeValidacao(erros);
    }

    resposta.status(201).json(await adminService.criarMembro(nome, email, senha));
  } catch (erro) {
    responderErro(resposta, erro, 'Erro ao adicionar membro da equipe');
  }
};

/** PUT /admin/equipe/:id/status — { ativo: boolean }. */
export const alterarStatusMembro = async (requisicao: Request, resposta: Response): Promise<void> => {
  try {
    const ativo = (requisicao.body as Record<string, unknown> | undefined)?.['ativo'] === true;
    resposta.json(await adminService.alterarStatusMembro(validarId(requisicao.params['id']), ativo, requisicao.admin!.id));
  } catch (erro) {
    responderErro(resposta, erro, 'Erro ao alterar o acesso');
  }
};
