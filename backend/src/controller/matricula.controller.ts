import type { Request, Response } from 'express';
import { assinaturaWebhookValida, chavePublicaMercadoPago, mercadoPagoConfigurado } from '../config/mercadopago.ts';
import * as matriculaService from '../services/matricula.service.ts';
import { ErroApp } from '../utils/erro-app.ts';
import { validarId } from '../utils/validacao.ts';
import { validarAvaliacao, validarMatricula, validarPagamento } from '../utils/validacao-matricula.ts';

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

/** POST /cursos/:id/matriculas — matricula o candidato (etapa "Dados da matrícula"). */
export const matricularNoCurso = async (requisicao: Request, resposta: Response): Promise<void> => {
  try {
    const idCurso = validarId(requisicao.params['id']);
    const dados = validarMatricula(requisicao.body);
    const matricula = await matriculaService.matricular(idCurso, dados);

    resposta.status(201).json(matricula);
  } catch (erro) {
    responderErro(resposta, erro, 'Erro ao realizar a matrícula');
  }
};

/** POST /cursos/:id/avaliacoes — nota de 1 a 5 de quem está matriculado. */
export const avaliarCurso = async (requisicao: Request, resposta: Response): Promise<void> => {
  try {
    const idCurso = validarId(requisicao.params['id']);
    const dados = validarAvaliacao(requisicao.body);
    await matriculaService.avaliar(idCurso, dados);

    resposta.status(204).send();
  } catch (erro) {
    responderErro(resposta, erro, 'Erro ao avaliar o curso');
  }
};

/** GET /usuarios/:id/matriculas — cursos em que o candidato está matriculado. */
export const listarMatriculasDoUsuario = async (requisicao: Request, resposta: Response): Promise<void> => {
  try {
    const idPcd = validarId(requisicao.params['id']);
    resposta.json(await matriculaService.listarMatriculas(idPcd));
  } catch (erro) {
    responderErro(resposta, erro, 'Erro ao buscar matrículas');
  }
};

/** GET /usuarios/:id/matriculas/:idCurso — matrícula do candidato no curso, com o último pagamento. */
export const obterMatriculaDoUsuario = async (requisicao: Request, resposta: Response): Promise<void> => {
  try {
    const idPcd = validarId(requisicao.params['id']);
    const idCurso = validarId(requisicao.params['idCurso']);
    resposta.json(await matriculaService.obterMatricula(idPcd, idCurso));
  } catch (erro) {
    responderErro(resposta, erro, 'Erro ao buscar matrícula');
  }
};

/** POST /matriculas/:id/pagamentos — cria a cobrança (Pix ou cartão) no Mercado Pago. */
export const pagarMatricula = async (requisicao: Request, resposta: Response): Promise<void> => {
  try {
    const idMatricula = validarId(requisicao.params['id']);
    const dados = validarPagamento(requisicao.body);
    const pagamento = await matriculaService.pagar(idMatricula, dados);

    resposta.status(201).json(pagamento);
  } catch (erro) {
    responderErro(resposta, erro, 'Erro ao processar o pagamento');
  }
};

/** GET /matriculas/:id/pagamentos/ultimo?idPcd= — status do pagamento (a tela do Pix consulta a cada poucos segundos). */
export const consultarPagamentoDaMatricula = async (requisicao: Request, resposta: Response): Promise<void> => {
  try {
    const idMatricula = validarId(requisicao.params['id']);
    const idPcd = validarId(requisicao.query['idPcd']);
    resposta.json(await matriculaService.consultarUltimoPagamento(idMatricula, idPcd));
  } catch (erro) {
    responderErro(resposta, erro, 'Erro ao consultar o pagamento');
  }
};

/** GET /pagamentos/config — chave pública do Mercado Pago, usada pelo navegador para tokenizar o cartão. */
export const obterConfiguracaoPagamentos = (_requisicao: Request, resposta: Response): void => {
  resposta.json({ habilitado: mercadoPagoConfigurado(), chavePublica: chavePublicaMercadoPago() });
};

/**
 * POST /pagamentos/webhook — aviso do Mercado Pago de que um pagamento mudou
 * (ex.: Pix pago). Responde 200 rápido, como o Mercado Pago exige; se der
 * erro ao processar, responde 500 para ele tentar de novo mais tarde.
 */
export const receberWebhook = async (requisicao: Request, resposta: Response): Promise<void> => {
  const corpo = (requisicao.body ?? {}) as { type?: string; action?: string; data?: { id?: string | number } };
  const idDado = String(requisicao.query['data.id'] ?? corpo.data?.id ?? '');
  const tipo = String(requisicao.query['type'] ?? corpo.type ?? '');

  if (!idDado || (tipo !== 'payment' && !corpo.action?.startsWith('payment'))) {
    resposta.status(200).send();
    return;
  }

  if (!assinaturaWebhookValida(requisicao.header('x-signature'), requisicao.header('x-request-id'), idDado)) {
    resposta.status(401).send();
    return;
  }

  try {
    await matriculaService.processarNotificacao(idDado);
    resposta.status(200).send();
  } catch (erro) {
    // 4xx do Mercado Pago = pagamento inexistente (ex.: "Simular notificação"
    // do painel, que manda um id fictício). Não adianta ele tentar de novo.
    if (erro instanceof ErroApp && erro.status === 422) {
      resposta.status(200).send();
      return;
    }

    console.error('Erro ao processar webhook do Mercado Pago:', erro);
    resposta.status(500).send();
  }
};
