import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';
import { Ambiente } from '../types/ambiente';

/**
 * Só deixa entrar na rota quem estiver logado no ambiente esperado — evita,
 * por exemplo, que uma empresa acesse a tela de outra empresa só porque
 * chegou direto pela URL sem estar autenticada como tal.
 */
export function ambienteGuard(ambiente: Ambiente): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const roteador = inject(Router);
    const sessao = authService.sessao();

    if (sessao?.ambiente === ambiente) {
      return true;
    }

    return roteador.createUrlTree(['/login']);
  };
}
