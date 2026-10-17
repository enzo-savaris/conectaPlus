import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, PLATFORM_ID, computed, effect, inject, signal, untracked } from '@angular/core';
import { Observable, map } from 'rxjs';

import { URL_BASE_API } from '../config/api';
import { Sessao } from '../types/sessao';
import { AuthService } from './auth.service';

/** Recursos de acessibilidade que o usuário liga e desliga no painel. */
export type RecursoAcessibilidade =
  | 'navegacaoTeclado'
  | 'leitorTexto'
  | 'contrasteEscuro'
  | 'contrasteClaro'
  | 'lupa'
  | 'monocromatico'
  | 'tecladoVirtual'
  | 'ampliadorTexto'
  | 'destacarLinks'
  | 'destacarCabecalhos'
  | 'descricoesImagem';

export type PreferenciasAcessibilidade = Record<RecursoAcessibilidade, boolean>;

/** Preferências de quem não está logado (landing, login, cadastro), só neste navegador. */
const CHAVE_VISITANTE = 'conecta+:acessibilidade:visitante';
/** Chave da versão anterior, compartilhada por todas as contas do navegador — descartada. */
const CHAVE_ANTIGA = 'conecta+:acessibilidade';

const PADRAO: PreferenciasAcessibilidade = {
  navegacaoTeclado: false,
  leitorTexto: false,
  contrasteEscuro: false,
  contrasteClaro: false,
  lupa: false,
  monocromatico: false,
  tecladoVirtual: false,
  ampliadorTexto: false,
  destacarLinks: false,
  destacarCabecalhos: false,
  descricoesImagem: false
};

/**
 * Recursos que são só CSS: viram uma classe `a11y-<nome>` no <html>, e o
 * styles.css faz o resto. Os demais (leitor, teclado virtual, ampliador,
 * descrições de imagem) têm comportamento em JavaScript, ligado em
 * `AcessibilidadeHost` e aqui mesmo.
 */
const CLASSES: Partial<Record<RecursoAcessibilidade, string>> = {
  navegacaoTeclado: 'a11y-teclado',
  contrasteEscuro: 'a11y-contraste-escuro',
  contrasteClaro: 'a11y-contraste-claro',
  lupa: 'a11y-lupa',
  monocromatico: 'a11y-monocromatico',
  destacarLinks: 'a11y-links',
  destacarCabecalhos: 'a11y-cabecalhos'
};

/** Os dois contrastes não fazem sentido juntos: ligar um desliga o outro. */
const EXCLUSIVOS: Partial<Record<RecursoAcessibilidade, RecursoAcessibilidade>> = {
  contrasteEscuro: 'contrasteClaro',
  contrasteClaro: 'contrasteEscuro'
};

/**
 * Preferências de acessibilidade da plataforma — uma por conta.
 *
 * - Logado (candidato ou empresa): as preferências vêm do banco
 *   (GET/PUT /acessibilidade) e são só daquela conta, em qualquer computador.
 * - Sem login: preferências de "visitante", guardadas só neste navegador.
 *   Sair da conta volta para elas — a próxima pessoa no mesmo computador não
 *   herda as configurações de quem saiu.
 * - Conta que ainda nunca salvou continua com o que estava ligado como
 *   visitante: quem precisou do alto contraste para conseguir fazer login
 *   não o perde ao entrar.
 *
 * As mudanças no painel valem na hora (pré-visualização), mas só ficam
 * guardadas ao clicar em "Salvar preferências"; fechar sem salvar desfaz.
 */
@Injectable({ providedIn: 'root' })
export class AcessibilidadeService {
  private readonly documento = inject(DOCUMENT);
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly noNavegador = isPlatformBrowser(inject(PLATFORM_ID));

  /** Última versão salva (da conta logada ou do visitante). */
  private readonly salvas = signal<PreferenciasAcessibilidade>(this.lerVisitante());

  readonly preferencias = signal<PreferenciasAcessibilidade>({ ...this.salvas() });
  readonly painelAberto = signal(false);
  readonly salvando = signal(false);
  readonly erroAoSalvar = signal<string | null>(null);

  /** Onde "Salvar" grava: na conta (logado) ou só neste navegador (visitante). */
  readonly salvaNaConta = computed(() => this.authService.sessao() !== null);

  /** Há algo diferente do que está salvo (para avisar no painel). */
  readonly alterado = computed(() => {
    const atual = this.preferencias();
    const salvas = this.salvas();
    return (Object.keys(PADRAO) as RecursoAcessibilidade[]).some((chave) => atual[chave] !== salvas[chave]);
  });

  /** Quantos recursos estão ligados (badge no botão do menu). */
  readonly totalAtivos = computed(() => Object.values(this.preferencias()).filter(Boolean).length);

  private observadorImagens: MutationObserver | null = null;
  /** Conta cujas preferências estão carregadas ("usuario:12", "empresa:25" ou "visitante"). */
  private contaCarregada = 'visitante';

  constructor() {
    if (!this.noNavegador) {
      return;
    }

    try {
      localStorage.removeItem(CHAVE_ANTIGA);
    } catch {
      // Sem acesso ao armazenamento: nada a limpar.
    }

    effect(() => this.aplicar(this.preferencias()));

    // Login, logout ou troca de conta: carrega as preferências de quem está usando agora.
    effect(() => {
      const sessao = this.authService.sessao();
      untracked(() => this.trocarDeConta(sessao));
    });

    // Atalho global: Alt + A abre/fecha o painel de qualquer tela.
    this.documento.addEventListener('keydown', (evento: KeyboardEvent) => {
      if (evento.altKey && !evento.ctrlKey && !evento.metaKey && evento.key.toLowerCase() === 'a') {
        evento.preventDefault();
        this.painelAberto() ? this.fecharPainel() : this.abrirPainel();
      }
    });
  }

  abrirPainel(): void {
    this.erroAoSalvar.set(null);
    this.painelAberto.set(true);
  }

  /** Fechar sem salvar descarta a pré-visualização. */
  fecharPainel(): void {
    this.preferencias.set({ ...this.salvas() });
    this.painelAberto.set(false);
  }

  alternar(recurso: RecursoAcessibilidade): void {
    this.preferencias.update((atual) => {
      const novo = { ...atual, [recurso]: !atual[recurso] };
      const oposto = EXCLUSIVOS[recurso];
      if (oposto && novo[recurso]) {
        novo[oposto] = false;
      }
      return novo;
    });
  }

  salvar(): void {
    const preferencias = { ...this.preferencias() };
    const sessao = this.authService.sessao();

    if (!sessao) {
      this.gravarVisitante(preferencias);
      this.salvas.set(preferencias);
      this.painelAberto.set(false);
      return;
    }

    this.salvando.set(true);
    this.erroAoSalvar.set(null);

    this.http
      .put<{ preferencias: PreferenciasAcessibilidade }>(`${URL_BASE_API}/acessibilidade`, {
        ...this.donoDa(sessao),
        preferencias
      })
      .subscribe({
        next: (resposta) => {
          this.salvando.set(false);
          this.salvas.set({ ...PADRAO, ...resposta.preferencias });
          this.painelAberto.set(false);
        },
        error: () => {
          // O painel continua aberto, com as opções escolhidas, para tentar de novo.
          this.salvando.set(false);
          this.erroAoSalvar.set('Não foi possível salvar na sua conta. Verifique a conexão e tente novamente.');
        }
      });
  }

  restaurarPadrao(): void {
    this.preferencias.set({ ...PADRAO });
  }

  private trocarDeConta(sessao: Sessao | null): void {
    const conta = sessao ? `${sessao.ambiente}:${sessao.perfil.id}` : 'visitante';
    if (conta === this.contaCarregada) {
      return;
    }
    this.contaCarregada = conta;
    this.painelAberto.set(false);

    if (!sessao) {
      const visitante = this.lerVisitante();
      this.salvas.set(visitante);
      this.preferencias.set({ ...visitante });
      return;
    }

    this.buscarDaConta(sessao).subscribe({
      next: (daConta) => {
        // A pessoa pode ter saído ou trocado de conta enquanto a resposta vinha.
        if (this.contaCarregada !== conta) {
          return;
        }

        if (daConta) {
          this.salvas.set(daConta);
          this.preferencias.set({ ...daConta });
        } else {
          // Nunca salvou na conta: continua com o que estava em uso (como
          // visitante), e é para isso que "fechar sem salvar" volta.
          this.salvas.set({ ...this.preferencias() });
        }
      },
      // Sem conexão com a API: mantém o que já estava aplicado na tela.
      error: () => undefined
    });
  }

  private buscarDaConta(sessao: Sessao): Observable<PreferenciasAcessibilidade | null> {
    const dono = this.donoDa(sessao);
    const parametros = new HttpParams({ fromObject: dono as Record<string, number> });

    return this.http
      .get<{ preferencias: PreferenciasAcessibilidade | null }>(`${URL_BASE_API}/acessibilidade`, { params: parametros })
      .pipe(map((resposta) => (resposta.preferencias ? { ...PADRAO, ...resposta.preferencias } : null)));
  }

  private donoDa(sessao: Sessao): { idPcd: number } | { idEmpresa: number } {
    return sessao.ambiente === 'usuario' ? { idPcd: sessao.perfil.id } : { idEmpresa: sessao.perfil.id };
  }

  private lerVisitante(): PreferenciasAcessibilidade {
    if (typeof localStorage === 'undefined') {
      return { ...PADRAO };
    }

    try {
      const bruto = localStorage.getItem(CHAVE_VISITANTE);
      return bruto ? { ...PADRAO, ...(JSON.parse(bruto) as Partial<PreferenciasAcessibilidade>) } : { ...PADRAO };
    } catch {
      return { ...PADRAO };
    }
  }

  private gravarVisitante(preferencias: PreferenciasAcessibilidade): void {
    try {
      localStorage.setItem(CHAVE_VISITANTE, JSON.stringify(preferencias));
    } catch {
      // Navegação anônima/armazenamento bloqueado: vale só até fechar a aba.
    }
  }

  private aplicar(preferencias: PreferenciasAcessibilidade): void {
    const raiz = this.documento.documentElement;

    for (const [recurso, classe] of Object.entries(CLASSES) as [RecursoAcessibilidade, string][]) {
      raiz.classList.toggle(classe, preferencias[recurso]);
    }

    if (!preferencias.leitorTexto && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    this.aplicarDescricoesImagem(preferencias.descricoesImagem);
  }

  // ============ DESCRIÇÕES DE IMAGEM ============

  /**
   * Mostra o texto alternativo (alt) de cada imagem como legenda visível logo
   * abaixo dela. <img> não aceita ::after no CSS, então a legenda é um
   * elemento de verdade, inserido aqui e mantido em dia por um
   * MutationObserver enquanto o usuário troca de tela.
   */
  private aplicarDescricoesImagem(ativo: boolean): void {
    if (!ativo) {
      this.observadorImagens?.disconnect();
      this.observadorImagens = null;
      this.documento.querySelectorAll('.a11y-descricao-imagem').forEach((legenda) => legenda.remove());
      return;
    }

    this.inserirDescricoes();

    if (!this.observadorImagens) {
      this.observadorImagens = new MutationObserver(() => this.inserirDescricoes());
      this.observadorImagens.observe(this.documento.body, { childList: true, subtree: true });
    }
  }

  private inserirDescricoes(): void {
    this.documento.querySelectorAll<HTMLImageElement>('img[alt]').forEach((imagem) => {
      const texto = imagem.alt.trim();
      const proximo = imagem.nextElementSibling;
      if (!texto || proximo?.classList.contains('a11y-descricao-imagem')) {
        return;
      }

      const legenda = this.documento.createElement('span');
      legenda.className = 'a11y-descricao-imagem';
      legenda.textContent = `Imagem: ${texto}`;
      // A legenda é só visual: o leitor de tela já anuncia o alt da própria imagem.
      legenda.setAttribute('aria-hidden', 'true');
      imagem.insertAdjacentElement('afterend', legenda);
    });
  }
}
