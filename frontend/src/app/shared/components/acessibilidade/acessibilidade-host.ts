import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  effect,
  inject,
  signal,
  viewChild
} from '@angular/core';

import { AcessibilidadeService, RecursoAcessibilidade } from '../../services/acessibilidade.service';
import { ToastService } from '../../services/toast.service';

interface OpcaoPainel {
  /** `null` = ação (Modo de leitura), não um liga/desliga. */
  recurso: RecursoAcessibilidade | null;
  rotulo: string;
  descricao: string;
  icone: string;
}

/** Ícones (paths SVG 24x24, traço) dos cartões do painel. */
const ICONES = {
  teclado: 'M7 7h10M4 12h16M7 17l-3-3 3-3M17 17l3-3-3-3',
  leitor: 'M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2',
  lua: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z',
  sol: 'M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  lupa: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM21 21l-5-5M11 8v6M8 11h6',
  olho: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12ZM12 14.8a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6Z',
  tecladoVirtual: 'M3 6.5h18v11H3zM7 10h.01M11 10h.01M15 10h.01M8 14h8',
  ampliador: 'M5 4h14v16H5zM8 8h8M8 12h8M8 16h5',
  leitura: 'M6 3h9l3 3v15H6zM9 11h6M9 15h6M9 7h3',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  cabecalho: 'M5 5v14M13 5v14M5 12h8M17 9l2-1v11',
  imagem: 'M4 5h16v14H4zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM20 16l-5-5-8 8'
};

const OPCOES: OpcaoPainel[] = [
  { recurso: 'navegacaoTeclado', rotulo: 'Navegação de Teclado', descricao: 'Navegue sem mouse: foco bem visível em cada item e atalho para pular ao conteúdo.', icone: ICONES.teclado },
  { recurso: 'leitorTexto', rotulo: 'Leitor de Texto', descricao: 'Lê em voz alta o texto em que você clicar ou focar com o teclado.', icone: ICONES.leitor },
  { recurso: 'contrasteEscuro', rotulo: 'Contraste Escuro', descricao: 'Fundo preto com letras brancas e destaques em amarelo.', icone: ICONES.lua },
  { recurso: 'contrasteClaro', rotulo: 'Contraste Claro', descricao: 'Fundo branco com letras pretas e links em azul escuro.', icone: ICONES.sol },
  { recurso: 'lupa', rotulo: 'Lupa', descricao: 'Aumenta todo o conteúdo da tela.', icone: ICONES.lupa },
  { recurso: 'monocromatico', rotulo: 'Monocromático', descricao: 'Mostra a tela em tons de cinza.', icone: ICONES.olho },
  { recurso: 'tecladoVirtual', rotulo: 'Teclado Virtual', descricao: 'Mostra um teclado na tela para digitar com o mouse ao clicar num campo.', icone: ICONES.tecladoVirtual },
  { recurso: 'ampliadorTexto', rotulo: 'Ampliador de Texto', descricao: 'Mostra o texto sob o cursor ampliado numa caixa ao lado.', icone: ICONES.ampliador },
  { recurso: null, rotulo: 'Modo de Leitura', descricao: 'Abre o conteúdo desta tela numa nova janela, limpo e fácil de ler.', icone: ICONES.leitura },
  { recurso: 'destacarLinks', rotulo: 'Destacar Links', descricao: 'Sublinha e destaca todos os links.', icone: ICONES.link },
  { recurso: 'destacarCabecalhos', rotulo: 'Destacar Cabeçalhos', descricao: 'Marca os títulos da página com o nível (H1, H2…).', icone: ICONES.cabecalho },
  { recurso: 'descricoesImagem', rotulo: 'Descrições de Imagem', descricao: 'Mostra a descrição (texto alternativo) abaixo de cada imagem.', icone: ICONES.imagem }
];

/** Teclas do teclado virtual, em minúsculas (o Shift/Caps passa para maiúsculas). */
const LINHAS_TECLADO = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '@'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ç', '.'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', 'á', 'é', 'ã', 'õ']
];

/** Campos em que o teclado virtual digita. */
const SELETOR_CAMPO_TEXTO =
  'textarea, input:not([type]), input[type="text"], input[type="email"], input[type="search"], input[type="tel"], input[type="password"], input[type="url"], input[type="number"]';

/**
 * Tudo de acessibilidade que precisa existir em qualquer tela: o painel de
 * opções (aberto pelo botão do menu ou por Alt + A), o link "Pular para o
 * conteúdo", o leitor de texto, o ampliador de texto e o teclado virtual.
 * Fica no componente raiz, ao lado dos toasts.
 */
@Component({
  selector: 'app-acessibilidade',
  templateUrl: './acessibilidade-host.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AcessibilidadeHost {
  protected readonly servico = inject(AcessibilidadeService);
  private readonly toastService = inject(ToastService);
  private readonly documento = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly noNavegador = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly opcoes = OPCOES;
  protected readonly linhasTeclado = LINHAS_TECLADO;
  protected readonly leituraDisponivel = this.noNavegador && 'speechSynthesis' in window;

  private readonly painel = viewChild<ElementRef<HTMLElement>>('painel');
  private elementoAntesDoPainel: HTMLElement | null = null;

  // Leitor de texto
  protected readonly lendo = signal(false);

  // Ampliador de texto
  protected readonly textoAmpliado = signal<string | null>(null);
  protected readonly posicaoAmpliador = signal({ x: 0, y: 0 });

  // Teclado virtual
  protected readonly campoAtivo = signal<HTMLInputElement | HTMLTextAreaElement | null>(null);
  protected readonly maiusculas = signal(false);

  constructor() {
    if (!this.noNavegador) {
      return;
    }

    // Abrir o painel move o foco para ele; fechar devolve para quem o abriu.
    effect(() => {
      if (this.servico.painelAberto()) {
        this.elementoAntesDoPainel = this.documento.activeElement as HTMLElement | null;
        queueMicrotask(() => this.painel()?.nativeElement.querySelector<HTMLElement>('button')?.focus());
      } else if (this.elementoAntesDoPainel) {
        this.elementoAntesDoPainel.focus?.();
        this.elementoAntesDoPainel = null;
      }
    });

    const aoClicar = (evento: MouseEvent) => this.lerAoClicar(evento);
    const aoFocar = (evento: FocusEvent) => this.aoFocar(evento);
    const aoMover = (evento: MouseEvent) => this.ampliarSobCursor(evento);
    const aoSairDaJanela = () => this.textoAmpliado.set(null);

    this.documento.addEventListener('click', aoClicar, true);
    this.documento.addEventListener('focusin', aoFocar);
    this.documento.addEventListener('mousemove', aoMover, { passive: true });
    this.documento.addEventListener('mouseleave', aoSairDaJanela);

    this.destroyRef.onDestroy(() => {
      this.documento.removeEventListener('click', aoClicar, true);
      this.documento.removeEventListener('focusin', aoFocar);
      this.documento.removeEventListener('mousemove', aoMover);
      this.documento.removeEventListener('mouseleave', aoSairDaJanela);
    });

    // Com o teclado virtual aberto, a página ganha espaço no fim para nada ficar escondido atrás dele.
    effect(() => {
      this.documento.body.style.paddingBottom = this.campoAtivo() ? '19rem' : '';
    });

    // Desligar um recurso some com o que ele estava mostrando.
    effect(() => {
      const preferencias = this.servico.preferencias();
      if (!preferencias.ampliadorTexto) {
        this.textoAmpliado.set(null);
      }
      if (!preferencias.tecladoVirtual) {
        this.campoAtivo.set(null);
      }
      if (!preferencias.leitorTexto) {
        this.lendo.set(false);
      }
    });
  }

  // ============ PAINEL ============

  protected ativo(opcao: OpcaoPainel): boolean {
    return opcao.recurso !== null && this.servico.preferencias()[opcao.recurso];
  }

  protected acionar(opcao: OpcaoPainel): void {
    if (opcao.recurso) {
      this.servico.alternar(opcao.recurso);
    } else {
      this.abrirModoLeitura();
    }
  }

  /** Esc fecha; Tab fica preso dentro do painel enquanto ele está aberto. */
  protected aoTeclarNoPainel(evento: KeyboardEvent): void {
    if (evento.key === 'Escape') {
      evento.preventDefault();
      this.servico.fecharPainel();
      return;
    }

    if (evento.key !== 'Tab') {
      return;
    }

    const focaveis = Array.from(
      this.painel()?.nativeElement.querySelectorAll<HTMLElement>('button, [href], input, textarea, select') ?? []
    );
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];

    if (evento.shiftKey && this.documento.activeElement === primeiro) {
      evento.preventDefault();
      ultimo?.focus();
    } else if (!evento.shiftKey && this.documento.activeElement === ultimo) {
      evento.preventDefault();
      primeiro?.focus();
    }
  }

  protected pularParaConteudo(evento: Event): void {
    evento.preventDefault();
    const conteudo = this.areaDeConteudo();
    if (conteudo) {
      conteudo.setAttribute('tabindex', '-1');
      conteudo.focus();
    }
  }

  /** A área principal da tela atual: o <main> mais interno (o Shell também tem um <main>). */
  private areaDeConteudo(): HTMLElement | null {
    const mains = this.documento.querySelectorAll<HTMLElement>('main');
    return mains[mains.length - 1] ?? this.documento.body;
  }

  // ============ LEITOR DE TEXTO ============

  private lerAoClicar(evento: MouseEvent): void {
    if (!this.servico.preferencias().leitorTexto) {
      return;
    }

    const alvo = evento.target as HTMLElement | null;
    if (!alvo || alvo.closest('.a11y-ignorar')) {
      return;
    }

    // Texto selecionado tem prioridade; senão, lê o elemento clicado.
    const selecao = this.documento.getSelection()?.toString().trim();
    this.falar(selecao || this.textoDe(alvo));
  }

  private aoFocar(evento: FocusEvent): void {
    const alvo = evento.target as HTMLElement | null;
    if (!alvo) {
      return;
    }

    const preferencias = this.servico.preferencias();

    // Teclado virtual: lembra o campo de texto em foco (fora do próprio teclado).
    if (preferencias.tecladoVirtual && alvo.matches(SELETOR_CAMPO_TEXTO) && !alvo.closest('.a11y-ignorar')) {
      const campo = alvo as HTMLInputElement | HTMLTextAreaElement;
      if (!campo.readOnly && !campo.disabled) {
        this.campoAtivo.set(campo);
      }
    }

    // Leitor de texto: quem navega pelo teclado ouve o nome de cada item focado.
    // (O clique já lê pelo outro listener; aqui só o foco vindo do teclado.)
    if (preferencias.leitorTexto && alvo.matches(':focus-visible') && !alvo.closest('.a11y-ignorar')) {
      this.falar(this.textoDe(alvo));
    }
  }

  /** O que faz sentido ler de um elemento: rótulo acessível, alt, rótulo do campo ou o texto visível. */
  private textoDe(elemento: HTMLElement): string {
    const rotulo = elemento.getAttribute('aria-label') ?? elemento.closest('[aria-label]')?.getAttribute('aria-label');
    if (elemento instanceof HTMLImageElement) {
      return elemento.alt;
    }

    if (elemento.matches('input, textarea, select')) {
      const campo = elemento as HTMLInputElement;
      const label = campo.id ? this.documento.querySelector(`label[for="${CSS.escape(campo.id)}"]`) : null;
      const nome = label?.textContent?.trim() || rotulo || campo.placeholder || 'Campo';
      const valor = campo.type === 'password' ? '' : campo.value;
      return valor ? `${nome}: ${valor}` : nome;
    }

    const texto = elemento.innerText?.replace(/\s+/g, ' ').trim();
    return (texto || rotulo || '').slice(0, 600);
  }

  private falar(texto: string): void {
    if (!this.leituraDisponivel || !texto) {
      return;
    }

    const sintese = window.speechSynthesis;
    sintese.cancel();

    const fala = new SpeechSynthesisUtterance(texto);
    fala.lang = 'pt-BR';
    const voz = sintese.getVoices().find((v) => v.lang.toLowerCase().startsWith('pt'));
    if (voz) {
      fala.voice = voz;
    }
    fala.onstart = () => this.lendo.set(true);
    fala.onend = () => this.lendo.set(false);
    fala.onerror = () => this.lendo.set(false);

    sintese.speak(fala);
  }

  protected pararLeitura(): void {
    window.speechSynthesis?.cancel();
    this.lendo.set(false);
  }

  // ============ AMPLIADOR DE TEXTO ============

  private quadroPendente = false;

  private ampliarSobCursor(evento: MouseEvent): void {
    if (!this.servico.preferencias().ampliadorTexto || this.quadroPendente) {
      return;
    }

    // Um cálculo por quadro de animação, no máximo: mousemove dispara muito.
    this.quadroPendente = true;
    requestAnimationFrame(() => {
      this.quadroPendente = false;

      const alvo = evento.target as HTMLElement | null;
      if (!alvo || alvo.closest('.a11y-ignorar') || alvo === this.documento.body) {
        this.textoAmpliado.set(null);
        return;
      }

      const texto = this.textoDe(alvo).slice(0, 220);
      // Containers grandes (o texto de uma tela inteira) não ajudam a ler: ignora.
      if (!texto || (alvo.innerText?.length ?? 0) > 600) {
        this.textoAmpliado.set(null);
        return;
      }

      this.textoAmpliado.set(texto);

      // Caixa ao lado do cursor, sem sair da tela. Com a Lupa ligada, o
      // zoom do <html> também amplia a posição da caixa: divide para compensar.
      const zoom = parseFloat(getComputedStyle(this.documento.documentElement).zoom) || 1;
      const largura = Math.min(480, window.innerWidth - 32);
      const x = Math.min(evento.clientX + 18, window.innerWidth - largura - 16);
      const y = evento.clientY + 24 > window.innerHeight - 140 ? evento.clientY - 140 : evento.clientY + 24;
      this.posicaoAmpliador.set({ x: Math.max(16, x) / zoom, y: Math.max(16, y) / zoom });
    });
  }

  // ============ TECLADO VIRTUAL ============

  protected teclaVisivel(tecla: string): string {
    return this.maiusculas() ? tecla.toUpperCase() : tecla;
  }

  protected digitar(texto: string): void {
    const campo = this.campoAtivo();
    if (!campo || !campo.isConnected) {
      this.campoAtivo.set(null);
      return;
    }

    if (campo.maxLength > 0 && campo.value.length >= campo.maxLength) {
      return;
    }

    this.inserirNoCampo(campo, texto);
  }

  protected apagar(): void {
    const campo = this.campoAtivo();
    if (!campo) {
      return;
    }

    if (this.aceitaSelecao(campo)) {
      const inicio = campo.selectionStart ?? campo.value.length;
      const fim = campo.selectionEnd ?? inicio;
      if (inicio === fim && inicio > 0) {
        campo.setRangeText('', inicio - 1, fim, 'end');
      } else if (inicio !== fim) {
        campo.setRangeText('', inicio, fim, 'end');
      }
    } else {
      campo.value = campo.value.slice(0, -1);
    }

    this.avisarAlteracao(campo);
  }

  protected proximoCampo(): void {
    const campo = this.campoAtivo();
    if (!campo) {
      return;
    }

    const campos = Array.from(this.documento.querySelectorAll<HTMLElement>(SELETOR_CAMPO_TEXTO)).filter(
      (item) => !item.closest('.a11y-ignorar') && item.offsetParent !== null
    );
    const proximo = campos[campos.indexOf(campo) + 1];
    proximo?.focus();
  }

  protected fecharTeclado(): void {
    this.campoAtivo.set(null);
  }

  private inserirNoCampo(campo: HTMLInputElement | HTMLTextAreaElement, texto: string): void {
    if (this.aceitaSelecao(campo)) {
      const inicio = campo.selectionStart ?? campo.value.length;
      const fim = campo.selectionEnd ?? inicio;
      campo.setRangeText(texto, inicio, fim, 'end');
    } else {
      campo.value += texto;
    }

    this.avisarAlteracao(campo);
  }

  /** E-mail e número não expõem a posição do cursor; nesses, o texto vai sempre no fim. */
  private aceitaSelecao(campo: HTMLInputElement | HTMLTextAreaElement): boolean {
    try {
      return campo.selectionStart !== null;
    } catch {
      return false;
    }
  }

  /** O Angular (formulários e máscaras) só percebe a mudança com um evento "input" de verdade. */
  private avisarAlteracao(campo: HTMLInputElement | HTMLTextAreaElement): void {
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    campo.focus();
  }

  // ============ MODO DE LEITURA ============

  /**
   * Copia o conteúdo principal da tela para uma janela nova, sem menus,
   * botões, ícones nem formulários, com letra grande e linha confortável.
   */
  private abrirModoLeitura(): void {
    const conteudo = this.areaDeConteudo();
    const janela = window.open('', '_blank');

    if (!janela || !conteudo) {
      this.toastService.erro('O navegador bloqueou a nova janela. Permita pop-ups para usar o Modo de Leitura.');
      return;
    }

    const copia = conteudo.cloneNode(true) as HTMLElement;
    copia
      .querySelectorAll(
        'script, style, svg, button, input, select, textarea, form, nav, iframe, [aria-hidden="true"], [hidden], .a11y-ignorar, .sr-only'
      )
      .forEach((elemento) => elemento.remove());

    // Só a estrutura e o texto: tira classes, eventos e atributos do Angular.
    copia.querySelectorAll('*').forEach((elemento) => {
      for (const atributo of Array.from(elemento.attributes)) {
        if (!['href', 'src', 'alt'].includes(atributo.name)) {
          elemento.removeAttribute(atributo.name);
        }
      }
      if (elemento instanceof HTMLAnchorElement && /^\s*javascript:/i.test(elemento.href)) {
        elemento.removeAttribute('href');
      }
    });

    const titulo = this.documento.title || 'Conecta+';
    const doc = janela.document;
    doc.open();
    doc.write(`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Modo de leitura · ${titulo.replace(/</g, '&lt;')}</title>
<style>
  body { margin: 0; background: #fbfaf6; color: #1b1b1b; font: 20px/1.75 Georgia, 'Times New Roman', serif; }
  article { max-width: 46rem; margin: 0 auto; padding: 2.5rem 1.25rem 4rem; }
  .aviso { font: 14px/1.4 system-ui, sans-serif; color: #555; border-bottom: 1px solid #ddd; padding-bottom: 1rem; margin-bottom: 2rem; }
  h1, h2, h3, h4 { line-height: 1.3; margin: 1.6em 0 .5em; }
  a { color: #0b4f9c; }
  img { max-width: 100%; height: auto; }
  ul, ol { padding-left: 1.4em; }
  div, section, header, aside, dl, li { margin: .35em 0; }
  dt { font-weight: bold; }
</style>
</head>
<body><article><p class="aviso">Modo de leitura — ${titulo.replace(/</g, '&lt;')}</p>${copia.innerHTML}</article></body>
</html>`);
    doc.close();
  }
}
