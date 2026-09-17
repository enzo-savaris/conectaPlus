import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { AuthService } from '../../shared/services/auth.service';
import { VagaService } from '../../shared/services/vaga.service';
import { MinhaCandidatura, VagaDetalhada } from '../../shared/types/vaga';
import {
  formatarLocalizacaoVaga,
  formatarSalarioVaga,
  formatarTipoContratacao
} from '../../shared/utils/vaga-format';

/** Quantidade de vagas mostradas na seção "Vagas em destaque". */
const QUANTIDADE_VAGAS_EM_DESTAQUE = 3;

/** Tela inicial do candidato PCD: vagas em destaque e atividade recente, vindas do banco. */
@Component({
  selector: 'app-painel',
  imports: [RouterLink],
  templateUrl: './painel.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Painel {
  private readonly authService = inject(AuthService);
  private readonly vagaService = inject(VagaService);

  protected readonly vagasDestaque = signal<VagaDetalhada[]>([]);
  protected readonly candidaturas = signal<MinhaCandidatura[]>([]);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);
  protected readonly termoBusca = signal('');

  protected readonly primeiroNome = computed(() => {
    const sessao = this.authService.sessao();
    const nome = sessao?.ambiente === 'usuario' ? sessao.perfil.nome : '';
    return nome.split(' ')[0] || nome;
  });

  /** Filtra as vagas em destaque por título, empresa, área, cidade ou requisito. */
  protected readonly vagasFiltradas = computed(() => {
    const termo = this.termoBusca().trim().toLowerCase();
    if (!termo) {
      return this.vagasDestaque();
    }

    return this.vagasDestaque().filter((vaga) =>
      [vaga.titulo, vaga.nomeEmpresa, vaga.area, vaga.cidade, ...vaga.requisitos]
        .filter((campo): campo is string => !!campo)
        .some((campo) => campo.toLowerCase().includes(termo))
    );
  });

  constructor() {
    this.carregar();
  }

  /** Garantido pelo ambienteGuard('usuario'): só entra aqui quem está logado como candidato. */
  private idCandidatoLogado(): number {
    const sessao = this.authService.sessao();
    return sessao?.ambiente === 'usuario' ? sessao.perfil.id : 0;
  }

  private carregar(): void {
    this.carregando.set(true);
    this.erro.set(null);

    const idPcd = this.idCandidatoLogado();

    this.vagaService.listar(undefined, 'ATIVA').subscribe({
      next: (vagas) => {
        const idsEmDestaque = vagas.slice(0, QUANTIDADE_VAGAS_EM_DESTAQUE).map((vaga) => vaga.id);

        if (idsEmDestaque.length === 0) {
          this.vagasDestaque.set([]);
          this.carregando.set(false);
          this.carregarCandidaturas(idPcd);
          return;
        }

        // Busca os detalhes (com requisitos) só das vagas em destaque, que são poucas.
        forkJoin(idsEmDestaque.map((id) => this.vagaService.obterPorId(id))).subscribe({
          next: (detalhes) => {
            this.vagasDestaque.set(detalhes);
            this.carregando.set(false);
            this.carregarCandidaturas(idPcd);
          },
          error: () => {
            this.erro.set('Não foi possível carregar as vagas em destaque.');
            this.carregando.set(false);
          }
        });
      },
      error: () => {
        this.erro.set('Não foi possível carregar as vagas em destaque.');
        this.carregando.set(false);
      }
    });
  }

  private carregarCandidaturas(idPcd: number): void {
    this.vagaService.listarMinhasCandidaturas(idPcd).subscribe({
      next: (candidaturas) => this.candidaturas.set(candidaturas),
      // Falha aqui não impede o resto do painel de funcionar; a seção só fica vazia.
      error: () => this.candidaturas.set([])
    });
  }

  protected aoDigitarBusca(evento: Event): void {
    this.termoBusca.set((evento.target as HTMLInputElement).value);
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

  protected formatarStatusCandidatura(status: MinhaCandidatura['status']): string {
    switch (status) {
      case 'EM_ANALISE':
        return 'Em análise';
      case 'APROVADO':
        return 'Aprovado';
      case 'REPROVADO':
        return 'Reprovado';
      default:
        return 'Enviada';
    }
  }

  protected corStatusCandidatura(status: MinhaCandidatura['status']): string {
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

  /** Formata a data da candidatura como tempo relativo ("2 dias atrás"), como no mockup. */
  protected formatarTempoRelativo(data: string): string {
    const diffDias = Math.floor((Date.now() - new Date(data).getTime()) / (1000 * 60 * 60 * 24));

    if (diffDias <= 0) {
      return 'Hoje';
    }
    if (diffDias === 1) {
      return '1 dia atrás';
    }
    if (diffDias < 7) {
      return `${diffDias} dias atrás`;
    }

    const semanas = Math.floor(diffDias / 7);
    if (semanas < 5) {
      return semanas === 1 ? '1 semana atrás' : `${semanas} semanas atrás`;
    }

    const meses = Math.floor(diffDias / 30);
    return meses <= 1 ? '1 mês atrás' : `${meses} meses atrás`;
  }
}
