import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { URL_BASE_API } from '../config/api';
import { PerfilEmpresa, Sessao } from '../types/sessao';

const CHAVE_ARMAZENAMENTO = 'conecta+:sessao';

/**
 * Guarda a sessão autenticada em memória (signal) e também no navegador, para
 * sobreviver a um F5 — sem isso, atualizar a página (ex.: para ver vagas
 * novas) jogava a pessoa de volta para o login.
 *
 * Onde fica guardada depende do "lembrar de mim":
 * - marcado: localStorage — continua logado mesmo fechando o navegador;
 * - desmarcado: sessionStorage — sobrevive ao F5 e à navegação, mas some ao
 *   fechar a aba, então ninguém herda a sessão num computador compartilhado.
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
        // Limpa os dois antes: sem isso, um login anterior com "lembrar de
        // mim" deixaria a sessão antiga no localStorage, e ela voltaria num F5.
        this.limparSessaoSalva();
        this.salvarSessao(sessao, lembrarDeMim ? this.armazenamentoLocal() : this.armazenamentoDaAba());
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

    // Regrava no mesmo lugar onde a sessão já estava (localStorage ou sessionStorage).
    for (const armazenamento of [this.armazenamentoLocal(), this.armazenamentoDaAba()]) {
      if (armazenamento?.getItem(CHAVE_ARMAZENAMENTO)) {
        this.salvarSessao(atualizada, armazenamento);
      }
    }
  }

  /** "Lembrar de mim" (localStorage) tem prioridade; senão, a sessão só desta aba. */
  private lerSessaoSalva(): Sessao | null {
    for (const armazenamento of [this.armazenamentoLocal(), this.armazenamentoDaAba()]) {
      const bruto = armazenamento?.getItem(CHAVE_ARMAZENAMENTO);
      if (!bruto) {
        continue;
      }

      try {
        return JSON.parse(bruto) as Sessao;
      } catch {
        armazenamento?.removeItem(CHAVE_ARMAZENAMENTO);
      }
    }

    return null;
  }

  private salvarSessao(sessao: Sessao, armazenamento: Storage | null): void {
    try {
      armazenamento?.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(sessao));
    } catch {
      // Armazenamento bloqueado (ex.: navegação privada restrita): a sessão vale até o F5.
    }
  }

  private limparSessaoSalva(): void {
    this.armazenamentoLocal()?.removeItem(CHAVE_ARMAZENAMENTO);
    this.armazenamentoDaAba()?.removeItem(CHAVE_ARMAZENAMENTO);
  }

  /** `null` no servidor (SSR/prerender), onde não existe armazenamento do navegador. */
  private armazenamentoLocal(): Storage | null {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  }

  private armazenamentoDaAba(): Storage | null {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  }
}
