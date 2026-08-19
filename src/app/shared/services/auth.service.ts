import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { URL_BASE_API } from '../config/api';
import { Sessao } from '../types/sessao';

const CHAVE_ARMAZENAMENTO = 'conecta+:sessao';

/**
 * Guarda a sessão autenticada em memória (signal) e, quando o usuário marca
 * "lembrar de mim", também no localStorage, para sobreviver a um F5.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly sessaoSignal = signal<Sessao | null>(this.lerSessaoSalva());

  readonly sessao = this.sessaoSignal.asReadonly();
  readonly logado = computed(() => this.sessaoSignal() !== null);

  entrar(documento: string, senha: string, lembrarDeMim: boolean): Observable<Sessao> {
    return this.http.post<Sessao>(`${URL_BASE_API}/auth/login`, { documento, senha }).pipe(
      tap((sessao) => {
        this.sessaoSignal.set(sessao);

        if (lembrarDeMim) {
          this.salvarSessao(sessao);
        }
      })
    );
  }

  sair(): void {
    this.sessaoSignal.set(null);

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(CHAVE_ARMAZENAMENTO);
    }
  }

  private lerSessaoSalva(): Sessao | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    const bruto = localStorage.getItem(CHAVE_ARMAZENAMENTO);
    if (!bruto) {
      return null;
    }

    try {
      return JSON.parse(bruto) as Sessao;
    } catch {
      return null;
    }
  }

  private salvarSessao(sessao: Sessao): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(sessao));
    }
  }
}
