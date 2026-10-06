import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CursoService } from '../../../shared/services/curso.service';
import { Curso } from '../../../shared/types/curso';
import { formatarCargaHorariaCurso, formatarPrecoCurso } from '../../../shared/utils/curso-format';

/** Tela do candidato PCD: cursos de capacitação de todas as empresas parceiras. */
@Component({
  selector: 'app-cursos-disponiveis',
  imports: [RouterLink],
  templateUrl: './cursos-disponiveis.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CursosDisponiveis {
  private readonly cursoService = inject(CursoService);

  protected readonly cursos = signal<Curso[]>([]);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);
  protected readonly termoBusca = signal('');

  /** Filtra por título ou empresa, mesmo critério das buscas de vaga. */
  protected readonly cursosFiltrados = computed(() => {
    const termo = this.termoBusca().trim().toLowerCase();
    if (!termo) {
      return this.cursos();
    }

    return this.cursos().filter((curso) =>
      [curso.titulo, curso.nomeEmpresa].some((campo) => campo.toLowerCase().includes(termo))
    );
  });

  constructor() {
    this.carregar();
  }

  private carregar(): void {
    this.carregando.set(true);
    this.erro.set(null);

    this.cursoService.listar(undefined, 'ATIVO').subscribe({
      next: (cursos) => {
        this.cursos.set(cursos);
        this.carregando.set(false);
      },
      error: () => {
        this.erro.set('Não foi possível carregar os cursos. Tente novamente.');
        this.carregando.set(false);
      }
    });
  }

  protected aoDigitarBusca(evento: Event): void {
    this.termoBusca.set((evento.target as HTMLInputElement).value);
  }

  protected formatarCargaHoraria(curso: Curso): string {
    return formatarCargaHorariaCurso(curso.cargaHoraria);
  }

  protected formatarPreco(curso: Curso): string {
    return formatarPrecoCurso(curso.preco);
  }
}
