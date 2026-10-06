import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthService } from '../../../shared/services/auth.service';
import { CursoService } from '../../../shared/services/curso.service';
import { CapituloCurso, CursoDetalhado } from '../../../shared/types/curso';
import { formatarCargaHorariaCurso, formatarPrecoCurso } from '../../../shared/utils/curso-format';

/**
 * Tela do candidato PCD: módulos e aulas do curso, todos abertos — sem
 * bloqueio progressivo, qualquer PCD logado acessa qualquer aula de
 * qualquer módulo a qualquer momento.
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

  protected readonly curso = signal<CursoDetalhado | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);

  /** Candidato vê o curso vindo de "Cursos Disponíveis"; empresa vê vindo da própria gestão de cursos. */
  protected readonly rotaCursos: string =
    this.authService.sessao()?.ambiente === 'empresa' ? '/cursos' : '/cursos-disponiveis';

  /** Ids dos módulos abertos (acordeão) — o primeiro já começa expandido. */
  private readonly modulosAbertos = signal<ReadonlySet<number>>(new Set());

  constructor() {
    const idCurso = Number(this.rota.snapshot.paramMap.get('id'));
    this.carregar(idCurso);
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

  protected totalAulas(curso: CursoDetalhado): number {
    return curso.modulos.reduce((total, modulo) => total + modulo.capitulos.length, 0);
  }

  protected formatarCargaHoraria(curso: CursoDetalhado): string {
    return formatarCargaHorariaCurso(curso.cargaHoraria);
  }

  protected formatarPreco(curso: CursoDetalhado): string {
    return formatarPrecoCurso(curso.preco);
  }
}
