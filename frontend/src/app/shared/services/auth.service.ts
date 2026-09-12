import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { URL_BASE_API } from '../config/api';
import { PerfilEmpresa, Sessao } from '../types/sessao';

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
        } else {
          // Sem isso, um login anterior com "lembrar de mim" marcado deixaria
          // a sessão salva no localStorage, e um F5 voltaria a logar como
          // aquela sessão antiga mesmo com a caixa desmarcada agora.
          this.limparSessaoSalva();
        }
      })
    );
  }

  sair(): void {
    this.sessaoSignal.set(null);
    this.limparSessaoSalva();
  }

  /**
   * Atualiza os dados da empresa guardados na sessão (ex.: status, depois de
   * editar o perfil). Sem isso, o front continuaria achando a empresa ATIVA
   * — ou vice-versa — até o próximo login, mesmo já sabendo do valor novo.
   */
  atualizarPerfilEmpresa(dados: Partial<PerfilEmpresa>): void {
    const atual = this.sessaoSignal();
    if (!atual || atual.ambiente !== 'empresa') {
      return;
    }

    const atualizada: Sessao = { ambiente: 'empresa', perfil: { ...atual.perfil, ...dados } };
    this.sessaoSignal.set(atualizada);

    if (typeof localStorage !== 'undefined' && localStorage.getItem(CHAVE_ARMAZENAMENTO)) {
      this.salvarSessao(atualizada);
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

  private limparSessaoSalva(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(CHAVE_ARMAZENAMENTO);
    }
  }
}
