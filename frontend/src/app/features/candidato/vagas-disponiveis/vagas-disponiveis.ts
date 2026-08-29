import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { AuthService } from '../../../shared/services/auth.service';
import { VagaService } from '../../../shared/services/vaga.service';
import { MinhaCandidatura, Vaga } from '../../../shared/types/vaga';
import {
  formatarLocalizacaoVaga,
  formatarSalarioVaga,
  formatarTipoContratacao
} from '../../../shared/utils/vaga-format';

/** Tela do candidato PCD: vagas abertas de todas as empresas, com candidatura em um clique. */
@Component({
  selector: 'app-vagas-disponiveis',
  templateUrl: './vagas-disponiveis.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VagasDisponiveis {
  private readonly vagaService = inject(VagaService);
  private readonly authService = inject(AuthService);

  protected readonly vagas = signal<Vaga[]>([]);
  protected readonly minhasCandidaturas = signal<MinhaCandidatura[]>([]);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);
  protected readonly candidatandoId = signal<number | null>(null);

  /** Ids das vagas em que o candidato já se candidatou, pra desabilitar o botão delas. */
  protected readonly idsCandidatados = computed(
    () => new Set(this.minhasCandidaturas().map((candidatura) => candidatura.idVaga))
  );

  constructor() {
    this.carregar();
  }

  /** Garantido pelo ambienteGuard('usuario'): só entra aqui quem está logado como candidato PCD. */
  private idCandidatoLogado(): number {
    const sessao = this.authService.sessao();
    return sessao?.ambiente === 'usuario' ? sessao.perfil.id : 0;
  }

  private carregar(): void {
    this.carregando.set(true);
    this.erro.set(null);

    const idPcd = this.idCandidatoLogado();

    forkJoin({
      vagas: this.vagaService.listar(undefined, 'ATIVA'),
      candidaturas: this.vagaService.listarMinhasCandidaturas(idPcd)
    }).subscribe({
      next: ({ vagas, candidaturas }) => {
        this.vagas.set(vagas);
        this.minhasCandidaturas.set(candidaturas);
        this.carregando.set(false);
      },
      error: () => {
        this.erro.set('Não foi possível carregar as vagas. Tente novamente.');
        this.carregando.set(false);
      }
    });
  }

  protected jaCandidatado(vaga: Vaga): boolean {
    return this.idsCandidatados().has(vaga.id);
  }

  protected candidatarSe(vaga: Vaga): void {
    this.erro.set(null);
    this.candidatandoId.set(vaga.id);

    const idPcd = this.idCandidatoLogado();

    this.vagaService.candidatar(vaga.id, idPcd).subscribe({
      next: () => {
        this.minhasCandidaturas.update((lista) => [
          ...lista,
          {
            idVaga: vaga.id,
            titulo: vaga.titulo,
            status: 'PENDENTE',
            dataCandidatura: new Date().toISOString()
          }
        ]);
        this.candidatandoId.set(null);
      },
      error: (erro: HttpErrorResponse) => {
        this.candidatandoId.set(null);

        if (erro.status === 409) {
          // Já tinha se candidatado antes (ex.: outra aba); só reflete o estado real.
          this.minhasCandidaturas.update((lista) =>
            lista.some((candidatura) => candidatura.idVaga === vaga.id)
              ? lista
              : [
                  ...lista,
                  {
                    idVaga: vaga.id,
                    titulo: vaga.titulo,
                    status: 'PENDENTE',
                    dataCandidatura: new Date().toISOString()
                  }
                ]
          );
          return;
        }

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
