import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  PLATFORM_ID,
  afterNextRender,
  computed,
  inject,
  signal
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { AuthService } from '../../../shared/services/auth.service';
import { CursoService } from '../../../shared/services/curso.service';
import { UsuarioService } from '../../../shared/services/usuario.service';
import { PerfilCandidato } from '../../../shared/types/candidato';
import { CursoDetalhado, MatriculaCurso, MetodoPagamento, PagamentoCurso } from '../../../shared/types/curso';
import {
  formatarCargaHorariaCurso,
  formatarMoeda,
  formatarNivelCurso
} from '../../../shared/utils/curso-format';
import { formatarCpf, formatarTelefone } from '../../../shared/utils/masks';
import {
  CardFormMercadoPago,
  carregarSdkMercadoPago,
  mensagemRecusaCartao
} from './mercadopago-sdk';

type Etapa = 1 | 2 | 3;

/** Opções de "Necessidades de acessibilidade" da etapa 1. */
const NECESSIDADES = [
  'Legendas nos vídeos',
  'Intérprete de Libras',
  'Compatibilidade com leitor de tela',
  'Audiodescrição',
  'Linguagem simplificada',
  'Tempo extra em atividades e avaliações'
];

/** Intervalo da consulta do status do Pix enquanto o QR Code está na tela. */
const INTERVALO_CONSULTA_PIX_MS = 5000;

/**
 * Fluxo de matrícula num curso, em três etapas:
 * 1. Dados da matrícula — confirma os dados pessoais (do perfil) e marca as
 *    necessidades de acessibilidade. Curso gratuito pula direto para a 3.
 * 2. Pagamento seguro — Pix (QR Code + copia e cola, aprovação automática)
 *    ou cartão de crédito (campos seguros do Mercado Pago, em até 12x).
 * 3. Confirmação — matrícula ativa, curso liberado.
 *
 * O status do pagamento sempre vem do backend, que consulta o Mercado Pago:
 * a tela nunca decide sozinha que um pagamento foi aprovado.
 */
@Component({
  selector: 'app-matricula-curso',
  imports: [RouterLink],
  templateUrl: './matricula-curso.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MatriculaCursoPagina {
  private readonly rota = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly cursoService = inject(CursoService);
  private readonly usuarioService = inject(UsuarioService);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly noNavegador = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly opcoesNecessidades = NECESSIDADES;

  private readonly idCurso = Number(this.rota.snapshot.paramMap.get('id'));

  protected readonly curso = signal<CursoDetalhado | null>(null);
  protected readonly perfil = signal<PerfilCandidato | null>(null);
  protected readonly matricula = signal<MatriculaCurso | null>(null);
  protected readonly pagamento = signal<PagamentoCurso | null>(null);
  protected readonly pagamentosHabilitados = signal(false);
  private chavePublica: string | null = null;

  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);
  protected readonly etapa = signal<Etapa>(1);

  // Etapa 1
  protected readonly necessidades = signal<ReadonlySet<string>>(new Set());
  protected readonly observacao = signal('');
  protected readonly salvandoMatricula = signal(false);
  protected readonly erroMatricula = signal<string | null>(null);

  // Etapa 2
  protected readonly metodo = signal<MetodoPagamento>('CARTAO');
  protected readonly processando = signal(false);
  protected readonly erroPagamento = signal<string | null>(null);
  protected readonly cartaoPronto = signal(false);
  protected readonly erroCartao = signal<string | null>(null);
  protected readonly copiado = signal(false);
  private cardForm: CardFormMercadoPago | null = null;
  private consultaPix: ReturnType<typeof setInterval> | null = null;

  /** Relógio para a contagem regressiva do Pix. */
  private readonly agora = signal(Date.now());

  protected readonly pago = computed(() => (this.curso()?.preco ?? 0) > 0);

  protected readonly valor = computed(() => this.matricula()?.valor ?? this.curso()?.preco ?? 0);

  protected readonly pixPendente = computed(() => {
    const pagamento = this.pagamento();
    return pagamento?.metodo === 'PIX' && pagamento.status === 'PENDENTE' && !!pagamento.pixCopiaECola;
  });

  /** "29:41" até o Pix expirar, ou `null` se já expirou. */
  protected readonly tempoRestantePix = computed(() => {
    const expiracao = this.pagamento()?.pixExpiracao;
    if (!expiracao) {
      return null;
    }

    const restante = new Date(expiracao).getTime() - this.agora();
    if (restante <= 0) {
      return null;
    }

    const minutos = Math.floor(restante / 60000);
    const segundos = Math.floor((restante % 60000) / 1000);
    return `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.pararConsultaPix();
      this.cardForm?.unmount();
    });

    if (this.noNavegador) {
      const relogio = setInterval(() => this.agora.set(Date.now()), 1000);
      this.destroyRef.onDestroy(() => clearInterval(relogio));
    }

    this.carregar();
  }

  private idCandidatoLogado(): number {
    const sessao = this.authService.sessao();
    // Garantido pelo ambienteGuard('usuario').
    return sessao?.ambiente === 'usuario' ? sessao.perfil.id : 0;
  }

  private carregar(): void {
    const idPcd = this.idCandidatoLogado();

    forkJoin({
      curso: this.cursoService.obterPorId(this.idCurso, { idPcd }),
      perfil: this.usuarioService.obterPorId(idPcd),
      // 404 = ainda não tem matrícula, o que é o caso normal aqui.
      matricula: this.cursoService.obterMatricula(idPcd, this.idCurso).pipe(catchError(() => of(null))),
      config: this.cursoService
        .obterConfiguracaoPagamentos()
        .pipe(catchError(() => of({ habilitado: false, chavePublica: null })))
    }).subscribe({
      next: ({ curso, perfil, matricula, config }) => {
        this.curso.set(curso);
        this.perfil.set(perfil);
        this.matricula.set(matricula);
        this.pagamentosHabilitados.set(config.habilitado);
        this.chavePublica = config.chavePublica;
        this.carregando.set(false);

        if (curso.status !== 'ATIVO' && matricula?.status !== 'ATIVA') {
          this.erro.set('Este curso não está recebendo novas matrículas.');
          return;
        }

        this.necessidades.set(
          new Set(matricula?.necessidades.length ? matricula.necessidades : this.necessidadesSugeridas(perfil))
        );
        this.observacao.set(matricula?.observacao ?? '');

        if (matricula?.status === 'ATIVA') {
          this.pagamento.set(matricula.pagamento);
          this.etapa.set(3);
          return;
        }

        // Voltou com um Pix ainda válido: retoma direto na tela do QR Code.
        const ultimo = matricula?.pagamento;
        if (
          ultimo?.metodo === 'PIX' &&
          ultimo.status === 'PENDENTE' &&
          ultimo.pixExpiracao &&
          new Date(ultimo.pixExpiracao).getTime() > Date.now()
        ) {
          this.pagamento.set(ultimo);
          this.metodo.set('PIX');
          this.irParaPagamento();
          this.iniciarConsultaPix();
        }
      },
      error: () => {
        this.erro.set('Não foi possível carregar este curso.');
        this.carregando.set(false);
      }
    });
  }

  /** Já marca as necessidades que combinam com os recursos de acessibilidade do perfil. */
  private necessidadesSugeridas(perfil: PerfilCandidato): string[] {
    const recursos = perfil.recursos.join(' ').toLowerCase();
    const regras: [RegExp, string][] = [
      [/legenda/, 'Legendas nos vídeos'],
      [/libras|int[ée]rprete/, 'Intérprete de Libras'],
      [/leitor de tela|nvda|jaws|voiceover/, 'Compatibilidade com leitor de tela'],
      [/audiodescri/, 'Audiodescrição'],
      [/linguagem simples|simplificad/, 'Linguagem simplificada'],
      [/tempo/, 'Tempo extra em atividades e avaliações']
    ];

    return regras.filter(([regra]) => regra.test(recursos)).map(([, necessidade]) => necessidade);
  }

  // ============ ETAPA 1 ============

  protected alternarNecessidade(necessidade: string): void {
    this.necessidades.update((atual) => {
      const novo = new Set(atual);
      if (novo.has(necessidade)) {
        novo.delete(necessidade);
      } else {
        novo.add(necessidade);
      }
      return novo;
    });
  }

  protected aoDigitarObservacao(evento: Event): void {
    this.observacao.set((evento.target as HTMLTextAreaElement).value);
  }

  protected confirmarDados(): void {
    this.salvandoMatricula.set(true);
    this.erroMatricula.set(null);

    this.cursoService
      .matricular(this.idCurso, this.idCandidatoLogado(), {
        necessidades: Array.from(this.necessidades()),
        observacao: this.observacao().trim()
      })
      .subscribe({
        next: (matricula) => {
          this.salvandoMatricula.set(false);
          this.matricula.set(matricula);

          if (matricula.status === 'ATIVA') {
            this.etapa.set(3);
          } else {
            this.irParaPagamento();
          }
        },
        error: (erro: HttpErrorResponse) => {
          this.salvandoMatricula.set(false);
          if (erro.status === 409) {
            // Já matriculado (ex.: outra aba): mostra a confirmação.
            this.etapa.set(3);
            return;
          }
          this.erroMatricula.set(erro.error?.mensagem ?? 'Não foi possível confirmar sua matrícula. Tente novamente.');
        }
      });
  }

  // ============ ETAPA 2 ============

  private irParaPagamento(): void {
    this.etapa.set(2);
    if (this.metodo() === 'CARTAO') {
      this.montarCartaoDepoisDeRenderizar();
    }
  }

  protected voltarParaDados(): void {
    this.pararConsultaPix();
    this.etapa.set(1);
    this.desmontarCartao();
  }

  protected escolherMetodo(metodo: MetodoPagamento): void {
    if (this.metodo() === metodo || this.processando()) {
      return;
    }

    this.metodo.set(metodo);
    this.erroPagamento.set(null);

    if (metodo === 'CARTAO') {
      this.montarCartaoDepoisDeRenderizar();
    } else {
      this.desmontarCartao();
    }
  }

  /** O cardForm precisa que os campos já existam no DOM, então espera o próximo render. */
  private montarCartaoDepoisDeRenderizar(): void {
    if (!this.noNavegador || !this.pagamentosHabilitados()) {
      return;
    }

    afterNextRender(() => void this.montarCartao(), { injector: this.injector });
  }

  private async montarCartao(): Promise<void> {
    if (this.cardForm || !this.chavePublica || !document.getElementById('form-cartao')) {
      return;
    }

    this.cartaoPronto.set(false);
    this.erroCartao.set(null);

    try {
      const MercadoPago = await carregarSdkMercadoPago();
      const mp = new MercadoPago(this.chavePublica, { locale: 'pt-BR' });

      const estiloCampo = {
        color: '#ffffff',
        placeholderColor: '#64748b',
        fontSize: '14px',
        fontFamily: 'inherit'
      };

      this.cardForm = mp.cardForm({
        amount: this.valor().toFixed(2),
        iframe: true,
        form: {
          id: 'form-cartao',
          cardNumber: { id: 'cartao-numero', placeholder: '0000 0000 0000 0000', style: estiloCampo },
          expirationDate: { id: 'cartao-validade', placeholder: 'MM/AA', style: estiloCampo },
          securityCode: { id: 'cartao-cvv', placeholder: 'CVV', style: estiloCampo },
          cardholderName: { id: 'cartao-nome', placeholder: 'Como está impresso no cartão' },
          issuer: { id: 'cartao-emissor', placeholder: 'Banco emissor' },
          installments: { id: 'cartao-parcelas', placeholder: 'Parcelas' },
          identificationType: { id: 'cartao-tipo-documento' },
          identificationNumber: { id: 'cartao-documento', placeholder: 'CPF do titular' },
          cardholderEmail: { id: 'cartao-email', placeholder: 'E-mail' }
        },
        callbacks: {
          onFormMounted: (erro: unknown) => {
            if (erro) {
              console.error(erro);
              this.erroCartao.set('Não foi possível carregar o formulário do cartão. Recarregue a página.');
              return;
            }
            this.preencherDadosDoTitular();
            this.cartaoPronto.set(true);
          },
          onSubmit: (evento: Event) => {
            evento.preventDefault();
            this.pagarComCartao();
          },
          onCardTokenReceived: (erros: unknown) => {
            if (erros) {
              this.processando.set(false);
              this.erroPagamento.set('Confira os dados do cartão: número, validade, CVV e CPF do titular.');
            }
          }
        }
      });
    } catch (erro) {
      console.error(erro);
      this.erroCartao.set('Não foi possível carregar o pagamento com cartão. Verifique sua conexão ou pague com Pix.');
    }
  }

  /** Sugere o nome, o CPF e o e-mail do perfil (o titular do cartão pode ser outra pessoa e trocar). */
  private preencherDadosDoTitular(): void {
    const perfil = this.perfil();
    if (!perfil) {
      return;
    }

    const preencher = (id: string, valor: string | null) => {
      const campo = document.getElementById(id) as HTMLInputElement | null;
      if (campo && !campo.value && valor) {
        campo.value = valor;
      }
    };

    preencher('cartao-nome', perfil.nome.toUpperCase());
    preencher('cartao-documento', perfil.cpf.replace(/\D/g, ''));
    preencher('cartao-email', perfil.email);
  }

  private desmontarCartao(): void {
    this.cardForm?.unmount();
    this.cardForm = null;
    this.cartaoPronto.set(false);
  }

  private pagarComCartao(): void {
    const matricula = this.matricula();
    if (!this.cardForm || !matricula || this.processando()) {
      return;
    }

    const dados = this.cardForm.getCardFormData();
    if (!dados.token) {
      this.erroPagamento.set('Confira os dados do cartão: número, validade, CVV e CPF do titular.');
      return;
    }

    this.processando.set(true);
    this.erroPagamento.set(null);

    this.cursoService
      .pagar(matricula.id, this.idCandidatoLogado(), {
        metodo: 'CARTAO',
        token: dados.token,
        bandeira: dados.paymentMethodId,
        idEmissor: dados.issuerId || null,
        parcelas: Number(dados.installments) || 1,
        email: dados.cardholderEmail,
        tipoDocumento: dados.identificationType,
        numeroDocumento: dados.identificationNumber
      })
      .subscribe({
        next: (pagamento) => {
          this.processando.set(false);
          this.pagamento.set(pagamento);
          this.tratarResultado(pagamento);
        },
        error: (erro: HttpErrorResponse) => this.tratarErroPagamento(erro)
      });
  }

  protected gerarPix(): void {
    const matricula = this.matricula();
    if (!matricula || this.processando()) {
      return;
    }

    this.processando.set(true);
    this.erroPagamento.set(null);

    this.cursoService.pagar(matricula.id, this.idCandidatoLogado(), { metodo: 'PIX' }).subscribe({
      next: (pagamento) => {
        this.processando.set(false);
        this.pagamento.set(pagamento);
        if (pagamento.status === 'PENDENTE') {
          this.iniciarConsultaPix();
        } else {
          this.tratarResultado(pagamento);
        }
      },
      error: (erro: HttpErrorResponse) => this.tratarErroPagamento(erro)
    });
  }

  private tratarErroPagamento(erro: HttpErrorResponse): void {
    this.processando.set(false);

    if (erro.status === 409) {
      // Matrícula já paga (ex.: Pix pago em outra aba).
      this.etapa.set(3);
      return;
    }

    this.erroPagamento.set(erro.error?.mensagem ?? 'Não foi possível processar o pagamento. Tente novamente.');
  }

  private tratarResultado(pagamento: PagamentoCurso): void {
    switch (pagamento.status) {
      case 'APROVADO':
        this.pararConsultaPix();
        this.desmontarCartao();
        this.matricula.update((atual) => (atual ? { ...atual, status: 'ATIVA' } : atual));
        this.etapa.set(3);
        break;
      case 'RECUSADO':
        this.erroPagamento.set(mensagemRecusaCartao(pagamento.detalheStatus));
        break;
      case 'PENDENTE':
        // Cartão em análise pelo emissor: acompanha como no Pix.
        this.iniciarConsultaPix();
        break;
      default:
        this.pararConsultaPix();
        this.erroPagamento.set(
          pagamento.metodo === 'PIX'
            ? 'O Pix expirou antes do pagamento. Gere um novo QR Code.'
            : 'O pagamento não foi concluído. Tente novamente.'
        );
    }
  }

  private iniciarConsultaPix(): void {
    if (!this.noNavegador || this.consultaPix) {
      return;
    }

    this.consultaPix = setInterval(() => this.consultarPagamento(), INTERVALO_CONSULTA_PIX_MS);
  }

  private pararConsultaPix(): void {
    if (this.consultaPix) {
      clearInterval(this.consultaPix);
      this.consultaPix = null;
    }
  }

  private consultarPagamento(): void {
    const matricula = this.matricula();
    if (!matricula) {
      return;
    }

    this.cursoService.consultarPagamento(matricula.id, this.idCandidatoLogado()).subscribe({
      next: (pagamento) => {
        this.pagamento.set(pagamento);
        if (pagamento.status !== 'PENDENTE') {
          this.pararConsultaPix();
          this.tratarResultado(pagamento);
        } else if (pagamento.pixExpiracao && new Date(pagamento.pixExpiracao).getTime() < Date.now()) {
          this.pararConsultaPix();
          this.erroPagamento.set('O Pix expirou antes do pagamento. Gere um novo QR Code.');
        }
      },
      // Falha momentânea de rede: tenta de novo no próximo intervalo.
      error: () => undefined
    });
  }

  protected async copiarPix(): Promise<void> {
    const codigo = this.pagamento()?.pixCopiaECola;
    if (!codigo) {
      return;
    }

    try {
      await navigator.clipboard.writeText(codigo);
      this.copiado.set(true);
      setTimeout(() => this.copiado.set(false), 3000);
    } catch {
      // Sem permissão de área de transferência: o código continua visível para copiar à mão.
    }
  }

  // ============ FORMATAÇÃO ============

  protected formatarMoeda(valor: number): string {
    return formatarMoeda(valor);
  }

  protected formatarCargaHoraria(horas: number | null): string {
    return formatarCargaHorariaCurso(horas);
  }

  protected formatarNivel(curso: CursoDetalhado): string {
    return formatarNivelCurso(curso.nivel);
  }

  protected formatarCpf(cpf: string): string {
    return formatarCpf(cpf);
  }

  protected formatarTelefone(telefone: string | null): string {
    return telefone ? formatarTelefone(telefone) : 'Não informado';
  }

  protected descreverPagamento(pagamento: PagamentoCurso): string {
    if (pagamento.metodo === 'PIX') {
      return `Pix · ${formatarMoeda(pagamento.valor)}`;
    }

    const bandeira = pagamento.cartaoBandeira ? pagamento.cartaoBandeira.toUpperCase() : 'Cartão';
    const final = pagamento.cartaoFinal ? ` final ${pagamento.cartaoFinal}` : '';
    const parcelas = pagamento.parcelas > 1 ? ` em ${pagamento.parcelas}x` : ' à vista';
    return `${bandeira}${final} · ${formatarMoeda(pagamento.valor)}${parcelas}`;
  }
}
