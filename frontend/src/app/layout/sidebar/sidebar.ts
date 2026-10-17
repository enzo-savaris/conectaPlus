import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import { AcessibilidadeService } from '../../shared/services/acessibilidade.service';
import { AuthService } from '../../shared/services/auth.service';
import { Ambiente } from '../../shared/types/ambiente';
import { Logo } from '../../shared/components/logo/logo';

/** Menu lateral global do sistema: recolhe para ícones e expande sob demanda. */
@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, Logo],
  templateUrl: './sidebar.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Sidebar {
  readonly ambiente = input<Ambiente>('usuario');

  protected readonly aberta = signal(true);

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

  constructor(private readonly roteador: Router) {}

  protected alternar(): void {
    this.aberta.update((valor) => !valor);
  }

  protected sair(): void {
    this.authService.sair();
    this.roteador.navigate(['/login']);
  }
}
