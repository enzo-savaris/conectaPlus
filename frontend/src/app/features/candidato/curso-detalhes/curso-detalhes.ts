import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthService } from '../../../shared/services/auth.service';
import { CursoService } from '../../../shared/services/curso.service';
import { ToastService } from '../../../shared/services/toast.service';
import { CapituloCurso, CursoDetalhado } from '../../../shared/types/curso';
import {
  formatarCargaHorariaCurso,
  formatarMoeda,
  formatarNivelCurso,
  formatarPrecoCurso
} from '../../../shared/utils/curso-format';

/**
 * Detalhes do curso para o candidato PCD: o que se aprende, a grade de
 * módulos e o preço. As aulas só abrem quando o conteúdo está liberado —
 * curso gratuito, ou pago com a matrícula ATIVA (pagamento aprovado); quem
 * ainda não pagou vê a grade com cadeado e o botão "Matricular-se".
 */
@Component({
  selector: 'app-curso-detalhes',
  imports: [RouterLink],
  templateUrl: './curso-detalhes.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CursoDetalhes {
  private readonly rota = inject(ActivatedRoute);
  private readonly cursoService = inject(CursoService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);

  protected readonly curso = signal<CursoDetalhado | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);

  /** Ids dos módulos abertos (acordeão). */
  private readonly modulosAbertos = signal<ReadonlySet<number>>(new Set());

  // Avaliação (só para quem está matriculado).
  protected readonly notaEscolhida = signal(0);
  protected readonly comentario = signal('');
  protected readonly enviandoAvaliacao = signal(false);

  protected readonly estrelas = [1, 2, 3, 4, 5];

  protected readonly pago = computed(() => (this.curso()?.preco ?? 0) > 0);
  protected readonly matriculado = computed(() => this.curso()?.matricula?.status === 'ATIVA');
  protected readonly aguardandoPagamento = computed(() => this.curso()?.matricula?.status === 'PENDENTE');

  private readonly idCurso = Number(this.rota.snapshot.paramMap.get('id'));

  constructor() {
    this.carregar();
  }

  private idCandidatoLogado(): number {
    const sessao = this.authService.sessao();
    // Garantido pelo ambienteGuard('usuario').
    return sessao?.ambiente === 'usuario' ? sessao.perfil.id : 0;
  }

  private carregar(): void {
    this.cursoService.obterPorId(this.idCurso, { idPcd: this.idCandidatoLogado() }).subscribe({
      next: (curso) => {
        this.curso.set(curso);
        this.carregando.set(false);

        if (curso.minhaAvaliacao) {
          this.notaEscolhida.set(curso.minhaAvaliacao.nota);
          this.comentario.set(curso.minhaAvaliacao.comentario ?? '');
        }

        // Quem já pode assistir encontra o primeiro módulo aberto.
        const primeiroModulo = curso.modulos[0];
        if (curso.conteudoLiberado && primeiroModulo) {
          this.modulosAbertos.set(new Set([primeiroModulo.id]));
        }
      },
      error: () => {
        this.erro.set('Não foi possível carregar esse curso. Ele pode ter sido removido.');
        this.carregando.set(false);
      }
    });
  }

  protected moduloAberto(idModulo: number): boolean {
    return this.modulosAbertos().has(idModulo);
  }

  protected alternarModulo(idModulo: number): void {
    this.modulosAbertos.update((atual) => {
      const novo = new Set(atual);
      if (novo.has(idModulo)) {
        novo.delete(idModulo);
      } else {
        novo.add(idModulo);
      }
      return novo;
    });
  }

  protected linkDoCapitulo(capitulo: CapituloCurso): string | null {
    return capitulo.tipoConteudo === 'LINK' ? capitulo.linkCapitulo : capitulo.arquivoCapituloUrl;
  }

  protected numeroModulo(indice: number): string {
    return String(indice + 1).padStart(2, '0');
  }

  protected formatarCargaHoraria(horas: number | null): string {
    return formatarCargaHorariaCurso(horas);
  }

  protected formatarPreco(curso: CursoDetalhado): string {
    return formatarPrecoCurso(curso.preco);
  }

  protected formatarNivel(curso: CursoDetalhado): string {
    return formatarNivelCurso(curso.nivel);
  }

  /** Simulação sem juros só para referência; as parcelas reais (com ou sem juros) vêm do Mercado Pago no pagamento. */
  protected formatarParcela(curso: CursoDetalhado): string {
    return formatarMoeda((curso.preco ?? 0) / 12);
  }

  protected aoDigitarComentario(evento: Event): void {
    this.comentario.set((evento.target as HTMLTextAreaElement).value);
  }

  protected enviarAvaliacao(): void {
    const curso = this.curso();
    if (!curso || this.notaEscolhida() === 0) {
      return;
    }

    this.enviandoAvaliacao.set(true);
    this.cursoService
      .avaliar(curso.id, this.idCandidatoLogado(), this.notaEscolhida(), this.comentario().trim())
      .subscribe({
        next: () => {
          this.enviandoAvaliacao.set(false);
          this.toastService.sucesso('Obrigado pela sua avaliação!');
          // Recarrega para atualizar a média exibida em "Informações gerais".
          this.carregar();
        },
        error: () => {
          this.enviandoAvaliacao.set(false);
          this.toastService.erro('Não foi possível enviar sua avaliação. Tente novamente.');
        }
      });
  }
}
