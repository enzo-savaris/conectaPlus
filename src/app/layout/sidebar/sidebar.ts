import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

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

  constructor(private readonly roteador: Router) {}

  protected alternar(): void {
    this.aberta.update((valor) => !valor);
  }

  protected sair(): void {
    // TODO: encerrar a sessão real quando o serviço de autenticação existir.
    this.roteador.navigate(['/login']);
  }
}
