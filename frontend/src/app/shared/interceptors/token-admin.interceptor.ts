import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { URL_BASE_API } from '../config/api';
import { AuthService } from '../services/auth.service';

/**
 * Anexa o token da equipe ("Authorization: Bearer ...") nas chamadas à API
 * /admin. Se o servidor responder 401 (token vencido ou acesso desativado),
 * encerra a sessão e leva para o login da equipe.
 */
export const tokenAdminInterceptor: HttpInterceptorFn = (requisicao, proximo) => {
  const ehAdmin = requisicao.url.startsWith(`${URL_BASE_API}/admin/`);
  const ehLogin = requisicao.url === `${URL_BASE_API}/admin/login`;
  if (!ehAdmin || ehLogin) {
    return proximo(requisicao);
  }

  const authService = inject(AuthService);
  const roteador = inject(Router);
  const token = authService.tokenAdmin();

  return proximo(token ? requisicao.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : requisicao).pipe(
    catchError((erro: unknown) => {
      if (erro instanceof HttpErrorResponse && erro.status === 401) {
        authService.sair();
        roteador.navigate(['/admin/login'], { queryParams: { expirou: 1 } });
      }
      return throwError(() => erro);
    })
  );
};
