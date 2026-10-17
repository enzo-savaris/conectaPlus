import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { Logo } from '../../../shared/components/logo/logo';
import { AcessibilidadeService } from '../../../shared/services/acessibilidade.service';
import { AuthService } from '../../../shared/services/auth.service';

/** Layout do ambiente da equipe: menu lateral próprio (Empresas, Equipe) + conteúdo. */
@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Logo],
  templateUrl: './admin-shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminShell {
  private readonly authService = inject(AuthService);
  private readonly roteador = inject(Router);
  protected readonly acessibilidade = inject(AcessibilidadeService);

  protected readonly nome = computed(() => {
    const sessao = this.authService.sessao();
    return sessao?.ambiente === 'admin' ? sessao.perfil.nome : '';
  });

  protected sair(): void {
    this.authService.sair();
    this.roteador.navigate(['/admin/login']);
  }
}
