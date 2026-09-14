import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../shared/services/auth.service';
import { VagaService } from '../../shared/services/vaga.service';
import { MinhaCandidatura, Vaga } from '../../shared/types/vaga';
import {
  formatarLocalizacaoVaga,
  formatarSalarioVaga,
  formatarTipoContratacao
} from '../../shared/utils/vaga-format';

const ID_SECAO_VAGAS = 'vagas-abertas';

/**
 * Landing page pública: qualquer visitante vê as vagas abertas de todas as
 * empresas sem precisar se cadastrar. Só candidatar-se exige login — ver os
 * detalhes da vaga continua livre.
 */
@Component({
  selector: 'app-landing',
  imports: [RouterLink],
  templateUrl: './landing.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Landing {
  private readonly vagaService = inject(VagaService);
  private readonly authService = inject(AuthService);
  private readonly roteador = inject(Router);

  protected readonly anoAtual = new Date().getFullYear();

  protected readonly vagas = signal<Vaga[]>([]);
  protected readonly minhasCandidaturas = signal<MinhaCandidatura[]>([]);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);
  protected readonly candidatandoId = signal<number | null>(null);
  protected readonly termoBusca = signal('');

  /** Ids das vagas em que o candidato logado já se candidatou, pra desabilitar o botão delas. */
  protected readonly idsCandidatados = computed(
    () => new Set(this.minhasCandidaturas().map((candidatura) => candidatura.idVaga))
  );

  /** Filtra por título, empresa, área ou localização — sem exigir busca exata. */
  protected readonly vagasFiltradas = computed(() => {
    const termo = this.termoBusca().trim().toLowerCase();
    if (!termo) {
      return this.vagas();
    }

    return this.vagas().filter((vaga) =>
      [vaga.titulo, vaga.nomeEmpresa, vaga.area, vaga.cidade, vaga.estado]
        .filter((campo): campo is string => !!campo)
        .some((campo) => campo.toLowerCase().includes(termo))
    );
  });

  constructor() {
    this.carregar();
  }

  private carregar(): void {
    this.carregando.set(true);
    this.erro.set(null);

    this.vagaService.listar(undefined, 'ATIVA').subscribe({
      next: (vagas) => {
        this.vagas.set(vagas);
        this.carregando.set(false);
        this.carregarMinhasCandidaturasSeLogado();
      },
      error: () => {
        this.erro.set('Não foi possível carregar as vagas agora. Tente novamente.');
        this.carregando.set(false);
      }
    });
  }

  /** Só existe "minhas candidaturas" pra quem já está logado como candidato PCD. */
  private carregarMinhasCandidaturasSeLogado(): void {
    const sessao = this.authService.sessao();
    if (sessao?.ambiente !== 'usuario') {
      return;
    }

    this.vagaService.listarMinhasCandidaturas(sessao.perfil.id).subscribe((candidaturas) => {
      this.minhasCandidaturas.set(candidaturas);
    });
  }

  protected aoDigitarBusca(evento: Event): void {
    this.termoBusca.set((evento.target as HTMLInputElement).value);
  }

  protected rolarParaVagas(): void {
    document.getElementById(ID_SECAO_VAGAS)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected jaCandidatado(vaga: Vaga): boolean {
    return this.idsCandidatados().has(vaga.id);
  }

  /**
   * Quem já está logado como candidato PCD se candidata na hora; visitante
   * (ou empresa, se por acaso estiver logada) é mandado pro login primeiro.
   */
  protected candidatarSe(vaga: Vaga): void {
    const sessao = this.authService.sessao();

    if (sessao?.ambiente !== 'usuario') {
      this.roteador.navigate(['/login']);
      return;
    }

    this.erro.set(null);
    this.candidatandoId.set(vaga.id);

    this.vagaService.candidatar(vaga.id, sessao.perfil.id).subscribe({
      next: () => {
        this.minhasCandidaturas.update((lista) => [
          ...lista,
          { idVaga: vaga.id, titulo: vaga.titulo, status: 'PENDENTE', dataCandidatura: new Date().toISOString() }
        ]);
        this.candidatandoId.set(null);
      },
      error: () => {
        this.candidatandoId.set(null);
        this.erro.set('Não foi possível enviar sua candidatura. Tente novamente.');
      }
    });
  }

  protected formatarLocalizacao(vaga: Vaga): string {
    return formatarLocalizacaoVaga(vaga);
  }

  protected formatarSalario(vaga: Vaga): string | null {
    return formatarSalarioVaga(vaga);
  }

  protected formatarTipoContratacao(vaga: Vaga): string {
    return formatarTipoContratacao(vaga.tipoContratacao);
  }
}
