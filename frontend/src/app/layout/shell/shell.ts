import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

import { AuthService } from '../../shared/services/auth.service';
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
  private readonly authService = inject(AuthService);

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
  //
  // Toda rota dentro do Shell já exige sessão, então data.ambiente aqui é só
  // para o menu lateral trocar "Perfil" (usuário) por "Candidatos" (empresa).
  // Rotas compartilhadas entre os dois ambientes (/curso, /perfil, /teste)
  // não marcam nada — nesses casos o ambiente vem da sessão logada, não de
  // um padrão fixo, senão uma empresa logada que navega para /curso
  // "perderia" o menu da empresa.
  private descobrirAmbiente(): Ambiente {
    let rota = this.roteador.routerState.snapshot.root;
    while (rota.firstChild) {
      rota = rota.firstChild;
    }

    const ambienteDaRota = rota.data['ambiente'] as Ambiente | undefined;
    return ambienteDaRota ?? this.authService.sessao()?.ambiente ?? 'usuario';
  }
}
