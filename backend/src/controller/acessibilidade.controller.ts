import type { Request, Response } from 'express';
import * as acessibilidadeService from '../services/acessibilidade.service.ts';
import type { DonoPreferencias } from '../services/acessibilidade.service.ts';
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

/** A conta vem como `idPcd` (candidato) ou `idEmpresa` (empresa) — exatamente um dos dois. */
function extrairDono(origem: Record<string, unknown>): DonoPreferencias {
  const temPcd = origem['idPcd'] !== undefined && origem['idPcd'] !== '';
  const temEmpresa = origem['idEmpresa'] !== undefined && origem['idEmpresa'] !== '';

  if (temPcd === temEmpresa) {
    throw erroDeValidacao({ conta: 'Informe idPcd ou idEmpresa (apenas um).' });
  }

  return temPcd
    ? { tipo: 'usuario', id: validarId(origem['idPcd']) }
    : { tipo: 'empresa', id: validarId(origem['idEmpresa']) };
}

/**
 * GET /acessibilidade?idPcd= | ?idEmpresa= — preferências da conta.
 * `preferencias: null` quando a conta ainda nunca salvou nada.
 */
export const obterPreferencias = async (requisicao: Request, resposta: Response): Promise<void> => {
  try {
    const dono = extrairDono(requisicao.query as Record<string, unknown>);
    resposta.json({ preferencias: await acessibilidadeService.obter(dono) });
  } catch (erro) {
    responderErro(resposta, erro, 'Erro ao buscar preferências de acessibilidade');
  }
};

/** PUT /acessibilidade — salva as preferências da conta informada no corpo. */
export const salvarPreferencias = async (requisicao: Request, resposta: Response): Promise<void> => {
  try {
    const corpo = (requisicao.body ?? {}) as Record<string, unknown>;
    const dono = extrairDono(corpo);
    const preferencias = acessibilidadeService.validarPreferencias(corpo['preferencias']);

    resposta.json({ preferencias: await acessibilidadeService.salvar(dono, preferencias) });
  } catch (erro) {
    responderErro(resposta, erro, 'Erro ao salvar preferências de acessibilidade');
  }
};
