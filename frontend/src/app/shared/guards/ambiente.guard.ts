import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';
import { AmbienteSessao } from '../types/sessao';

/** Tela inicial de cada ambiente, usada quando o guard precisa mandar alguém de volta pro lugar certo. */
export const ROTA_INICIAL: Record<AmbienteSessao, string> = {
  usuario: '/painel',
  empresa: '/empresa/painel',
  admin: '/admin/empresas'
};

/**
 * Só deixa entrar na rota quem estiver logado no ambiente esperado — evita,
 * por exemplo, que uma empresa acesse a tela de um candidato (ou vice-versa)
 * só por digitar a URL direto no navegador, sem estar autenticada como tal.
 */
export function ambienteGuard(ambiente: AmbienteSessao): CanActivateFn {
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

    // A equipe tem login próprio; os demais, o login comum.
    return roteador.createUrlTree([ambiente === 'admin' ? '/admin/login' : '/login']);
  };
}

/**
 * Telas de quem ainda não entrou (landing, login e cadastros). Quem já tem
 * sessão — por exemplo, marcou "Lembrar de mim" e voltou dias depois — vai
 * direto para a tela Início do seu ambiente, em vez de ver a página pública
 * ou o formulário de login de novo.
 */
export const visitanteGuard: CanActivateFn = () => {
  const sessao = inject(AuthService).sessao();
  return sessao ? inject(Router).createUrlTree([ROTA_INICIAL[sessao.ambiente]]) : true;
};
