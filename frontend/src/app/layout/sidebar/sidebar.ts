import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';

import { AcessibilidadeService } from '../../shared/services/acessibilidade.service';
import { AuthService } from '../../shared/services/auth.service';
import { Ambiente } from '../../shared/types/ambiente';
import { Logo } from '../../shared/components/logo/logo';

/**
 * Menu lateral global do sistema: recolhe para ícones e expande sob demanda.
 * No celular vira uma gaveta que desliza por cima do conteúdo, aberta pelo
 * botão da barra do topo.
 */
@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, Logo],
  templateUrl: './sidebar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'contents',
    '(document:keydown.escape)': 'fecharGaveta()'
  }
})
export class Sidebar {
  readonly ambiente = input<Ambiente>('usuario');

  protected readonly aberta = signal(true);

  /** Abaixo do breakpoint `md` do Tailwind (768px) o menu vira gaveta. */
  private readonly consultaCelular = matchMedia('(max-width: 767.98px)');
  protected readonly ehCelular = signal(this.consultaCelular.matches);
  protected readonly gavetaAberta = signal(false);

  /** Na gaveta do celular o menu fica sempre expandido, com os textos. */
  protected readonly expandida = computed(() => this.ehCelular() || this.aberta());

  private readonly authService = inject(AuthService);
  protected readonly acessibilidade = inject(AcessibilidadeService);

  /**
   * No ambiente da empresa, mostra o nome fantasia (ou a razão social, se não
   * houver fantasia) da empresa logada no lugar da marca "CONECTA+".
   */
  protected readonly nomeExibido = computed(() => {
    const sessao = this.authService.sessao();

    if (this.ambiente() === 'empresa' && sessao?.ambiente === 'empresa') {
      return sessao.perfil.nomeFantasia ?? sessao.perfil.razaoSocial;
    }

    return 'CONECTA+';
  });

  constructor(private readonly roteador: Router) {
    const aoMudarTamanho = (evento: MediaQueryListEvent) => {
      this.ehCelular.set(evento.matches);
      if (!evento.matches) {
        this.gavetaAberta.set(false);
      }
    };
    this.consultaCelular.addEventListener('change', aoMudarTamanho);
    inject(DestroyRef).onDestroy(() => this.consultaCelular.removeEventListener('change', aoMudarTamanho));

    // Tocar num item do menu no celular leva à tela e já recolhe a gaveta.
    this.roteador.events
      .pipe(
        filter((evento) => evento instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(() => this.fecharGaveta());
  }

  protected abrirGaveta(): void {
    this.gavetaAberta.set(true);
  }

  protected fecharGaveta(): void {
    this.gavetaAberta.set(false);
  }

  protected alternar(): void {
    this.aberta.update((valor) => !valor);
  }

  protected sair(): void {
    this.authService.sair();
    this.roteador.navigate(['/login']);
  }
}
