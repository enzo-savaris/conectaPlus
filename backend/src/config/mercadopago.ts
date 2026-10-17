import { createHmac, timingSafeEqual } from 'node:crypto';
import { ErroApp } from '../utils/erro-app.ts';

/**
 * Integração com a API de pagamentos do Mercado Pago (Checkout Transparente).
 *
 * Variáveis do .env:
 * - MP_ACCESS_TOKEN: credencial secreta da sua conta (começa com TEST- nas
 *   credenciais de teste e APP_USR- nas de produção). Nunca vai pro frontend.
 * - MP_PUBLIC_KEY: credencial pública, usada pelo navegador para transformar
 *   os dados do cartão num token — o número do cartão nunca passa por aqui.
 * - MP_URL_NOTIFICACAO (opcional): URL pública do webhook, ex.:
 *   https://seu-endereco.ngrok-free.dev/api/pagamentos/webhook
 * - MP_WEBHOOK_SECRET (opcional): assinatura secreta do webhook, para
 *   recusar notificações que não vieram do Mercado Pago.
 */

const URL_API = 'https://api.mercadopago.com';

export function mercadoPagoConfigurado(): boolean {
  return Boolean(process.env['MP_ACCESS_TOKEN'] && process.env['MP_PUBLIC_KEY']);
}

export function chavePublicaMercadoPago(): string | null {
  return process.env['MP_PUBLIC_KEY'] || null;
}

export function urlNotificacaoMercadoPago(): string | null {
  return process.env['MP_URL_NOTIFICACAO'] || null;
}

/** Só os campos da resposta do Mercado Pago que a plataforma usa. */
export interface PagamentoMercadoPago {
  id: number;
  status: string;
  status_detail: string;
  transaction_amount: number;
  installments: number;
  payment_method_id: string;
  external_reference: string | null;
  date_of_expiration: string | null;
  card?: { last_four_digits?: string | null };
  point_of_interaction?: {
    transaction_data?: { qr_code?: string; qr_code_base64?: string };
  };
}

async function chamar<T>(caminho: string, opcoes: RequestInit): Promise<T> {
  const token = process.env['MP_ACCESS_TOKEN'];
  if (!token) {
    throw new ErroApp(503, 'Os pagamentos ainda não foram configurados na plataforma.');
  }

  let resposta: Response;
  try {
    resposta = await fetch(`${URL_API}${caminho}`, {
      ...opcoes,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(opcoes.headers ?? {})
      },
      signal: AbortSignal.timeout(20_000)
    });
  } catch (erro) {
    console.error('Falha ao falar com o Mercado Pago:', erro);
    throw new ErroApp(502, 'Não foi possível falar com o serviço de pagamento. Tente novamente.');
  }

  const corpo = (await resposta.json().catch(() => null)) as Record<string, unknown> | null;

  if (!resposta.ok) {
    // O detalhe vai pro log do servidor; o usuário recebe uma mensagem genérica.
    console.error(`Mercado Pago respondeu ${resposta.status}:`, JSON.stringify(corpo));
    throw new ErroApp(
      resposta.status >= 500 ? 502 : 422,
      'O pagamento não pôde ser processado. Confira os dados e tente novamente.'
    );
  }

  return corpo as T;
}

/**
 * Cria o pagamento. `chaveIdempotencia` garante que, se a requisição for
 * repetida (rede instável, clique duplo), o Mercado Pago não cobre duas vezes.
 */
export function criarPagamentoMercadoPago(
  corpo: Record<string, unknown>,
  chaveIdempotencia: string
): Promise<PagamentoMercadoPago> {
  return chamar<PagamentoMercadoPago>('/v1/payments', {
    method: 'POST',
    body: JSON.stringify(corpo),
    headers: { 'X-Idempotency-Key': chaveIdempotencia }
  });
}

export function consultarPagamentoMercadoPago(id: string): Promise<PagamentoMercadoPago> {
  return chamar<PagamentoMercadoPago>(`/v1/payments/${encodeURIComponent(id)}`, { method: 'GET' });
}

/**
 * Confere a assinatura do webhook (cabeçalho x-signature), conforme a
 * documentação do Mercado Pago: HMAC-SHA256 do texto
 * "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" com a assinatura secreta.
 * Sem MP_WEBHOOK_SECRET configurado, aceita a notificação — o que não é
 * perigoso, porque o status é sempre reconsultado direto na API do Mercado
 * Pago antes de liberar qualquer matrícula; a notificação só serve de aviso.
 */
export function assinaturaWebhookValida(
  assinatura: string | undefined,
  idRequisicao: string | undefined,
  idDado: string
): boolean {
  const segredo = process.env['MP_WEBHOOK_SECRET'];
  if (!segredo) {
    return true;
  }

  if (!assinatura) {
    return false;
  }

  const partes = Object.fromEntries(
    assinatura.split(',').map((parte) => {
      const [chave, ...valor] = parte.trim().split('=');
      return [chave, valor.join('=')];
    })
  );

  const ts = partes['ts'];
  const v1 = partes['v1'];
  if (!ts || !v1) {
    return false;
  }

  let manifesto = `id:${idDado.toLowerCase()};`;
  if (idRequisicao) {
    manifesto += `request-id:${idRequisicao};`;
  }
  manifesto += `ts:${ts};`;

  const esperado = createHmac('sha256', segredo).update(manifesto).digest('hex');

  return esperado.length === v1.length && timingSafeEqual(Buffer.from(esperado), Buffer.from(v1));
}

/** "2026-10-14T15:30:00.000-03:00" — formato de data que o Mercado Pago aceita, no fuso do servidor. */
export function formatarDataMercadoPago(data: Date): string {
  const deslocamento = -data.getTimezoneOffset();
  const sinal = deslocamento >= 0 ? '+' : '-';
  const horas = String(Math.floor(Math.abs(deslocamento) / 60)).padStart(2, '0');
  const minutos = String(Math.abs(deslocamento) % 60).padStart(2, '0');
  const local = new Date(data.getTime() + deslocamento * 60_000).toISOString().slice(0, 23);

  return `${local}${sinal}${horas}:${minutos}`;
}
