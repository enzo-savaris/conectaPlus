import { Injectable, signal } from '@angular/core';

export type TipoToast = 'sucesso' | 'erro';

export interface Toast {
  id: number;
  texto: string;
  tipo: TipoToast;
}

const DURACAO_PADRAO_MS = 4000;

/**
 * Mensagens flutuantes no canto inferior direito, por cima de qualquer tela
 * (autenticada ou não) — o host fica no componente raiz, então funciona
 * tanto nas telas com sidebar quanto nas de fora do Shell (ex.: cadastro).
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);

  private proximoId = 0;

  sucesso(texto: string, duracaoMs = DURACAO_PADRAO_MS): void {
    this.mostrar(texto, 'sucesso', duracaoMs);
  }

  erro(texto: string, duracaoMs = DURACAO_PADRAO_MS): void {
    this.mostrar(texto, 'erro', duracaoMs);
  }

  remover(id: number): void {
    this.toasts.update((lista) => lista.filter((toast) => toast.id !== id));
  }

  private mostrar(texto: string, tipo: TipoToast, duracaoMs: number): void {
    const id = ++this.proximoId;
    this.toasts.update((lista) => [...lista, { id, texto, tipo }]);

    setTimeout(() => this.remover(id), duracaoMs);
  }
}
