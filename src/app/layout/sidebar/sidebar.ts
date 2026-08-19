import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../shared/services/auth.service';
import { Ambiente } from '../../shared/types/ambiente';

/** Menu lateral global do sistema: recolhe para ícones e expande sob demanda. */
@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Sidebar {
  readonly ambiente = input<Ambiente>('usuario');

  protected readonly aberta = signal(true);

  private readonly authService = inject(AuthService);

  constructor(private readonly roteador: Router) {}

  protected alternar(): void {
    this.aberta.update((valor) => !valor);
  }

  protected sair(): void {
    this.authService.sair();
    this.roteador.navigate(['/login']);
  }
}
