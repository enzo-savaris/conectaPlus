import { Router } from 'express';
import { obterConfiguracaoPagamentos, receberWebhook } from '../controller/matricula.controller.ts';

const rotasPagamento = Router();

rotasPagamento.get('/config', obterConfiguracaoPagamentos);
rotasPagamento.post('/webhook', receberWebhook);

export default rotasPagamento;
