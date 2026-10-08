import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../shared/services/auth.service';
import { CursoService } from '../../shared/services/curso.service';
import { Curso } from '../../shared/types/curso';
import { formatarCargaHorariaCurso, formatarPrecoCurso } from '../../shared/utils/curso-format';

/** Tela de cursos: lista os cursos da empresa logada, com seus detalhes, vindos do banco. */
@Component({
  selector: 'app-cursos',
  templateUrl: './cursos.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Cursos {
  private readonly cursoService = inject(CursoService);
  private readonly authService = inject(AuthService);
  private readonly roteador = inject(Router);

  protected readonly cursos = signal<Curso[]>([]);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);

  /**
   * Só empresa ATIVA pode cadastrar/editar cursos; PENDENTE (ex.: depois de
   * mudar CNPJ/razão social) ou INATIVA só pode visualizar os já cadastrados.
   */
  protected readonly empresaAtiva = computed(() => {
    const sessao = this.authService.sessao();
    return sessao?.ambiente !== 'empresa' || sessao.perfil.status === 'ATIVA';
  });

  constructor() {
    this.carregarCursos();
  }

  /** Garantido pelo ambienteGuard('empresa'): só entra aqui quem está logado como empresa. */
  private idEmpresaLogada(): number {
    const sessao = this.authService.sessao();
    return sessao?.ambiente === 'empresa' ? sessao.perfil.id : 0;
  }

  protected carregarCursos(): void {
    this.carregando.set(true);
    this.erro.set(null);

    this.cursoService.listar(this.idEmpresaLogada()).subscribe({
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

  protected aoClicarCadastrarCurso(): void {
    this.roteador.navigate(['/empresa/cursos/novo']);
  }

  protected aoClicarDetalhes(curso: Curso): void {
    this.roteador.navigate(['/empresa/cursos', curso.id]);
  }

  protected aoClicarEditar(curso: Curso): void {
    this.roteador.navigate(['/empresa/cursos', curso.id, 'editar']);
  }

  protected formatarCargaHoraria(curso: Curso): string {
    return formatarCargaHorariaCurso(curso.cargaHoraria);
  }

  protected formatarPreco(curso: Curso): string {
    return formatarPrecoCurso(curso.preco);
  }
}
