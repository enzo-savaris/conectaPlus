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
  protected readonly jaCandidatado = signal(false);

  constructor() {
    const idVaga = Number(this.rota.snapshot.paramMap.get('id'));
    this.carregar(idVaga);
    this.verificarCandidatura(idVaga);
  }

  /** Candidato logado que já se candidatou vê "Acompanhar candidatura" no lugar do botão. */
  private verificarCandidatura(idVaga: number): void {
    const sessao = this.authService.sessao();
    if (sessao?.ambiente !== 'usuario') {
      return;
    }

    this.vagaService.obterMinhaCandidatura(sessao.perfil.id, idVaga).subscribe({
      next: () => this.jaCandidatado.set(true),
      // 404: ainda não se candidatou — o botão de candidatar continua aparecendo.
      error: () => this.jaCandidatado.set(false)
    });
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
   * Quem já está logado como candidato PCD vai para a tela de candidatura;
   * visitante (ou empresa, se por acaso estiver logada) é mandado pro login primeiro.
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

    this.roteador.navigate(['/vagas-disponiveis', vaga.id, 'candidatar']);
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

  /**
   * A empresa cadastra os benefícios como texto livre (ex.: "Vale refeição"),
   * então o ícone do card é escolhido por palavra-chave — sem categoria
   * cadastrada no banco, é a forma mais simples de dar uma pista visual sem
   * exigir que a empresa escolha um ícone na hora de cadastrar a vaga.
   */
  protected iconeBeneficio(item: string): 'alimentacao' | 'transporte' | 'saude' | 'folga' | 'generico' {
    const texto = item.toLowerCase();

    if (/refei|aliment|restaurante/.test(texto)) {
      return 'alimentacao';
    }
    if (/transport|combust|estacionamento/.test(texto)) {
      return 'transporte';
    }
    if (/sa[úu]de|m[ée]dic|odont|psic/.test(texto)) {
      return 'saude';
    }
    if (/anivers|day ?off|f[ée]rias|folga/.test(texto)) {
      return 'folga';
    }

    return 'generico';
  }
}
