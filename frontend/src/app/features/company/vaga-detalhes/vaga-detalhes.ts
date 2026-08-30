import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { AuthService } from '../../../shared/services/auth.service';
import { VagaService } from '../../../shared/services/vaga.service';
import { Candidatura, CursoRecomendado, VagaDetalhada } from '../../../shared/types/vaga';
import { formatarCargaHorariaCurso, formatarPrecoCurso } from '../../../shared/utils/curso-format';
import {
  formatarLocalizacaoVaga,
  formatarSalarioVaga,
  formatarTipoContratacao
} from '../../../shared/utils/vaga-format';

/** Tela de detalhes da vaga: dados completos e inscritos, vindos do banco. */
@Component({
  selector: 'app-vaga-detalhes',
  templateUrl: './vaga-detalhes.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VagaDetalhes {
  private readonly rota = inject(ActivatedRoute);
  private readonly roteador = inject(Router);
  private readonly vagaService = inject(VagaService);
  private readonly authService = inject(AuthService);

  protected readonly vaga = signal<VagaDetalhada | null>(null);
  protected readonly candidaturas = signal<Candidatura[]>([]);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);

  constructor() {
    const idVaga = Number(this.rota.snapshot.paramMap.get('id'));
    this.carregar(idVaga);
  }

  /** Garantido pelo ambienteGuard('empresa'): só entra aqui quem está logado como empresa. */
  private idEmpresaLogada(): number {
    const sessao = this.authService.sessao();
    return sessao?.ambiente === 'empresa' ? sessao.perfil.id : 0;
  }

  private carregar(idVaga: number): void {
    this.carregando.set(true);
    this.erro.set(null);

    const idEmpresa = this.idEmpresaLogada();

    forkJoin({
      vaga: this.vagaService.obterPorId(idVaga),
      candidaturas: this.vagaService.listarCandidaturas(idVaga, idEmpresa)
    }).subscribe({
      next: ({ vaga, candidaturas }) => {
        this.vaga.set(vaga);
        this.candidaturas.set(candidaturas);
        this.carregando.set(false);
      },
      error: () => {
        this.erro.set('Não foi possível carregar os dados da vaga.');
        this.carregando.set(false);
      }
    });
  }

  protected aoClicarVoltar(): void {
    this.roteador.navigate(['/vagas']);
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

  protected formatarStatusCandidatura(status: Candidatura['status']): string {
    switch (status) {
      case 'EM_ANALISE':
        return 'Em análise';
      case 'APROVADO':
        return 'Aprovado';
      case 'REPROVADO':
        return 'Reprovado';
      default:
        return 'Novo';
    }
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

  protected corStatusCandidatura(status: Candidatura['status']): string {
    switch (status) {
      case 'EM_ANALISE':
        return 'bg-amber-400';
      case 'APROVADO':
        return 'bg-emerald-400';
      case 'REPROVADO':
        return 'bg-rose-400';
      default:
        return 'bg-brand-400';
    }
  }
}
