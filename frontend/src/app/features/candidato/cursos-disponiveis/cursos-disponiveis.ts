import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { AuthService } from '../../../shared/services/auth.service';

import { CursoService } from '../../../shared/services/curso.service';
import { Curso, StatusMatricula } from '../../../shared/types/curso';
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
  private readonly authService = inject(AuthService);

  /** Status da matrícula do candidato em cada curso (id do curso → status). */
  protected readonly matriculas = signal<ReadonlyMap<number, StatusMatricula>>(new Map());

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

    const sessao = this.authService.sessao();
    const idPcd = sessao?.ambiente === 'usuario' ? sessao.perfil.id : 0;

    forkJoin({
      cursos: this.cursoService.listar(undefined, 'ATIVO'),
      // Sem as matrículas a lista ainda funciona; só não mostra o selo "Matriculado".
      matriculas: this.cursoService.listarMatriculas(idPcd).pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ cursos, matriculas }) => {
        this.cursos.set(cursos);
        this.matriculas.set(new Map(matriculas.map((item) => [item.idCurso, item.status])));
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
