import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../shared/services/auth.service';
import { VagaService } from '../../shared/services/vaga.service';
import { CursoRecomendado, VagaDetalhada } from '../../shared/types/vaga';
import { formatarCargaHorariaCurso, formatarPrecoCurso } from '../../shared/utils/curso-format';
import {
  formatarLocalizacaoVaga,
  formatarSalarioVaga,
  formatarTipoContratacao
} from '../../shared/utils/vaga-format';

/**
 * Página pública da vaga: qualquer visitante pode ver os detalhes completos
 * sem se cadastrar. Só candidatar-se exige estar logado como candidato PCD.
 */
@Component({
  selector: 'app-vaga-publica',
  imports: [RouterLink],
  templateUrl: './vaga-publica.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VagaPublica {
  private readonly rota = inject(ActivatedRoute);
  private readonly roteador = inject(Router);
  private readonly vagaService = inject(VagaService);
  private readonly authService = inject(AuthService);

  protected readonly vaga = signal<VagaDetalhada | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);
  protected readonly candidatando = signal(false);
  protected readonly jaCandidatado = signal(false);
  protected readonly erroCandidatura = signal<string | null>(null);

  constructor() {
    const idVaga = Number(this.rota.snapshot.paramMap.get('id'));
    this.carregar(idVaga);
  }

  private carregar(idVaga: number): void {
    this.carregando.set(true);
    this.erro.set(null);

    this.vagaService.obterPorId(idVaga).subscribe({
      next: (vaga) => {
        this.vaga.set(vaga);
        this.carregando.set(false);
      },
      error: () => {
        this.erro.set('Não foi possível carregar essa vaga. Ela pode ter sido removida ou encerrada.');
        this.carregando.set(false);
      }
    });
  }

  /**
   * Quem já está logado como candidato PCD se candidata na hora; visitante
   * (ou empresa, se por acaso estiver logada) é mandado pro login primeiro.
   */
  protected candidatarSe(): void {
    const vaga = this.vaga();
    const sessao = this.authService.sessao();

    if (!vaga) {
      return;
    }

    if (sessao?.ambiente !== 'usuario') {
      this.roteador.navigate(['/login']);
      return;
    }

    this.erroCandidatura.set(null);
    this.candidatando.set(true);

    this.vagaService.candidatar(vaga.id, sessao.perfil.id).subscribe({
      next: () => {
        this.candidatando.set(false);
        this.jaCandidatado.set(true);
      },
      error: (erro: HttpErrorResponse) => {
        this.candidatando.set(false);

        if (erro.status === 409) {
          // Já tinha se candidatado antes (ex.: outra aba); só reflete o estado real.
          this.jaCandidatado.set(true);
          return;
        }

        this.erroCandidatura.set('Não foi possível enviar sua candidatura. Tente novamente.');
      }
    });
  }

  protected formatarLocalizacao(vaga: VagaDetalhada): string {
    return formatarLocalizacaoVaga(vaga);
  }

  protected formatarSalario(vaga: VagaDetalhada): string | null {
    return formatarSalarioVaga(vaga);
  }

  protected formatarTipoContratacao(vaga: VagaDetalhada): string {
    return formatarTipoContratacao(vaga.tipoContratacao);
  }

  protected formatarCargaHorariaCurso(curso: CursoRecomendado): string {
    return formatarCargaHorariaCurso(curso.cargaHoraria);
  }

  protected formatarPrecoCurso(curso: CursoRecomendado): string {
    return formatarPrecoCurso(curso.preco);
  }

  protected linkDoCurso(curso: CursoRecomendado): string | null {
    return curso.tipoConteudo === 'LINK' ? curso.linkCurso : curso.arquivoCursoUrl;
  }
}
