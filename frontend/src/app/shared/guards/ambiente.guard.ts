import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';
import { Ambiente } from '../types/ambiente';

/** Tela inicial de cada ambiente, usada quando o guard precisa mandar alguém de volta pro lugar certo. */
const ROTA_INICIAL: Record<Ambiente, string> = {
  usuario: '/painel',
  empresa: '/empresa/painel'
};

/**
 * Só deixa entrar na rota quem estiver logado no ambiente esperado — evita,
 * por exemplo, que uma empresa acesse a tela de um candidato (ou vice-versa)
 * só por digitar a URL direto no navegador, sem estar autenticada como tal.
 */
export function ambienteGuard(ambiente: Ambiente): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const roteador = inject(Router);
    const sessao = authService.sessao();

    if (sessao?.ambiente === ambiente) {
      return true;
    }

    // Já tem sessão, só que no ambiente errado: manda pra tela inicial dela
    // em vez do login, que não faz sentido pra quem já está autenticado.
    if (sessao) {
      return roteador.createUrlTree([ROTA_INICIAL[sessao.ambiente]]);
    }

    return roteador.createUrlTree(['/login']);
  };
}
