import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthService } from '../../../shared/services/auth.service';
import { CursoService } from '../../../shared/services/curso.service';
import { CapituloCurso, CursoDetalhado } from '../../../shared/types/curso';
import { formatarCargaHorariaCurso, formatarPrecoCurso } from '../../../shared/utils/curso-format';

/** Tela de detalhes do curso para a empresa: dados, status e estrutura de módulos/aulas, com atalho de edição. */
@Component({
  selector: 'app-curso-detalhes-empresa',
  imports: [RouterLink],
  templateUrl: './curso-detalhes-empresa.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CursoDetalhesEmpresa {
  private readonly rota = inject(ActivatedRoute);
  private readonly cursoService = inject(CursoService);
  private readonly authService = inject(AuthService);

  protected readonly curso = signal<CursoDetalhado | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);
  private readonly modulosAbertos = signal<ReadonlySet<number>>(new Set());

  /** Só empresa ATIVA edita; PENDENTE/INATIVA apenas visualiza. */
  protected readonly empresaAtiva = computed(() => {
    const sessao = this.authService.sessao();
    return sessao?.ambiente !== 'empresa' || sessao.perfil.status === 'ATIVA';
  });

  protected readonly totalAulas = computed(
    () => this.curso()?.modulos.reduce((total, modulo) => total + modulo.capitulos.length, 0) ?? 0
  );

  constructor() {
    this.carregar(Number(this.rota.snapshot.paramMap.get('id')));
  }

  private carregar(idCurso: number): void {
    this.carregando.set(true);
    this.erro.set(null);

    this.cursoService.obterPorId(idCurso).subscribe({
      next: (curso) => {
        this.curso.set(curso);
        this.carregando.set(false);

        const primeiroModulo = curso.modulos[0];
        if (primeiroModulo) {
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
      if (!novo.delete(idModulo)) {
        novo.add(idModulo);
      }
      return novo;
    });
  }

  protected linkDoCapitulo(capitulo: CapituloCurso): string | null {
    return capitulo.tipoConteudo === 'LINK' ? capitulo.linkCapitulo : capitulo.arquivoCapituloUrl;
  }

  protected formatarCargaHoraria(curso: CursoDetalhado): string {
    return formatarCargaHorariaCurso(curso.cargaHoraria);
  }

  protected formatarPreco(curso: CursoDetalhado): string {
    return formatarPrecoCurso(curso.preco);
  }

  protected formatarData(curso: CursoDetalhado): string {
    return new Date(curso.dataCadastro).toLocaleDateString('pt-BR');
  }
}
