import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

/**
 * Tela intermediária, sem sidebar, exibida depois do cadastro de empresa e
 * quando uma empresa PENDENTE tenta logar: ninguém acessa a plataforma
 * enquanto a existência da empresa não é confirmada manualmente.
 */
@Component({
  selector: 'app-aguardando-confirmacao',
  imports: [],
  templateUrl: './aguardando-confirmacao.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AguardandoConfirmacao {
  private readonly roteador = inject(Router);

  protected aoVoltar(): void {
    this.roteador.navigate(['/login']);
  }
}
