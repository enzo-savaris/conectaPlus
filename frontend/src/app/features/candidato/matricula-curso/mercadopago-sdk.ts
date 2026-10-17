/**
 * Carrega o SDK JS v2 do Mercado Pago (https://sdk.mercadopago.com/js/v2).
 *
 * O SDK cria os campos de número do cartão, validade e CVV dentro de iframes
 * do próprio Mercado Pago ("secure fields"): o que o usuário digita ali nunca
 * passa pelo código da plataforma — o SDK devolve só um token de uso único,
 * que o backend usa para cobrar. É isso que mantém a plataforma fora do
 * escopo de armazenar/transmitir dados de cartão (PCI).
 */

const URL_SDK = 'https://sdk.mercadopago.com/js/v2';

/** Só o pedaço da API do SDK que a tela de pagamento usa. */
export interface DadosCartaoMercadoPago {
  token: string;
  paymentMethodId: string;
  issuerId: string;
  installments: string;
  cardholderEmail: string;
  identificationType: string;
  identificationNumber: string;
}

export interface CardFormMercadoPago {
  getCardFormData(): DadosCartaoMercadoPago;
  unmount(): void;
}

export interface InstanciaMercadoPago {
  cardForm(opcoes: Record<string, unknown>): CardFormMercadoPago;
}

type ConstrutorMercadoPago = new (chavePublica: string, opcoes?: { locale?: string }) => InstanciaMercadoPago;

let carregamento: Promise<ConstrutorMercadoPago> | null = null;

export function carregarSdkMercadoPago(): Promise<ConstrutorMercadoPago> {
  const global = window as unknown as { MercadoPago?: ConstrutorMercadoPago };
  if (global.MercadoPago) {
    return Promise.resolve(global.MercadoPago);
  }

  carregamento ??= new Promise((resolver, rejeitar) => {
    const script = document.createElement('script');
    script.src = URL_SDK;
    script.async = true;
    script.onload = () =>
      global.MercadoPago ? resolver(global.MercadoPago) : rejeitar(new Error('SDK do Mercado Pago indisponível.'));
    script.onerror = () => {
      carregamento = null;
      rejeitar(new Error('Não foi possível carregar o SDK do Mercado Pago.'));
    };
    document.head.appendChild(script);
  });

  return carregamento;
}

/** Mensagem amigável para o motivo de recusa do cartão (status_detail do Mercado Pago). */
export function mensagemRecusaCartao(detalhe: string | null): string {
  switch (detalhe) {
    case 'cc_rejected_insufficient_amount':
      return 'O cartão não tem limite suficiente. Tente outro cartão ou pague com Pix.';
    case 'cc_rejected_bad_filled_security_code':
      return 'O código de segurança (CVV) está incorreto.';
    case 'cc_rejected_bad_filled_date':
      return 'A data de validade do cartão está incorreta.';
    case 'cc_rejected_bad_filled_card_number':
      return 'O número do cartão está incorreto.';
    case 'cc_rejected_bad_filled_other':
      return 'Algum dado do cartão está incorreto. Confira e tente novamente.';
    case 'cc_rejected_call_for_authorize':
      return 'O banco pediu autorização para esta compra. Ligue para o seu banco e tente de novo.';
    case 'cc_rejected_card_disabled':
      return 'O cartão está bloqueado ou inativo. Fale com o seu banco.';
    case 'cc_rejected_duplicated_payment':
      return 'Já existe um pagamento igual a este. Aguarde alguns minutos antes de tentar de novo.';
    case 'cc_rejected_max_attempts':
      return 'Limite de tentativas atingido. Use outro cartão ou pague com Pix.';
    case 'cc_rejected_high_risk':
      return 'O pagamento foi recusado por segurança. Tente outro cartão ou pague com Pix.';
    default:
      return 'O pagamento foi recusado. Tente outro cartão ou pague com Pix.';
  }
}
