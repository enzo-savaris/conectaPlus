import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

import { Ambiente } from '../../shared/types/ambiente';
import { Sidebar } from '../sidebar/sidebar';

/** Layout global das telas autenticadas: sidebar fixa + área de conteúdo roteada. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Sidebar],
  templateUrl: './shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Shell {
  private readonly roteador = inject(Router);

  protected readonly ambiente = toSignal(
    this.roteador.events.pipe(
      filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd),
      map(() => this.descobrirAmbiente())
    ),
    { initialValue: this.descobrirAmbiente() }
  );

  // Usa a árvore de snapshot do RouterState (já resolvida por completo para a
  // navegação atual) em vez de ActivatedRoute.firstChild, cujo `.snapshot` só
  // fica disponível depois que o outlet do filho realmente o ativa.
  private descobrirAmbiente(): Ambiente {
    let rota = this.roteador.routerState.snapshot.root;
    while (rota.firstChild) {
      rota = rota.firstChild;
    }
    return (rota.data['ambiente'] as Ambiente | undefined) ?? 'usuario';
  }
}
