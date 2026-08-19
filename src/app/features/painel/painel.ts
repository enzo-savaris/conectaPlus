import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { AuthService } from '../../shared/services/auth.service';
import { formatarCpf } from '../../shared/utils/masks';

/**
 * Tela de teste: confirma que o login do candidato PCD (via CPF) funciona
 * de ponta a ponta com o backend. Provisória até o painel real existir.
 */
@Component({
  selector: 'app-painel',
  templateUrl: './painel.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Painel {
  private readonly authService = inject(AuthService);

  /** Garantido pelo ambienteGuard('usuario'): só entra aqui quem está logado como candidato. */
  protected readonly perfil = computed(() => {
    const sessao = this.authService.sessao();
    return sessao?.ambiente === 'usuario' ? sessao.perfil : null;
  });

  protected readonly cpfFormatado = computed(() => {
    const perfil = this.perfil();
    return perfil ? formatarCpf(perfil.cpf) : '';
  });
}
