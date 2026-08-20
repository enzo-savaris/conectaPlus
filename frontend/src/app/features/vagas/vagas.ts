import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../shared/services/auth.service';
import { VagaService } from '../../shared/services/vaga.service';
import { Vaga } from '../../shared/types/vaga';
import { formatarLocalizacaoVaga, formatarSalarioVaga } from '../../shared/utils/vaga-format';

/** Tela de vagas: lista as vagas da empresa logada, vindas do banco. */
@Component({
  selector: 'app-vagas',
  templateUrl: './vagas.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Vagas {
  private readonly vagaService = inject(VagaService);
  private readonly authService = inject(AuthService);
  private readonly roteador = inject(Router);

  protected readonly vagas = signal<Vaga[]>([]);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);
  protected readonly excluindoId = signal<number | null>(null);

  constructor() {
    this.carregarVagas();
  }

  /** Garantido pelo ambienteGuard('empresa'): só entra aqui quem está logado como empresa. */
  private idEmpresaLogada(): number {
    const sessao = this.authService.sessao();
    return sessao?.ambiente === 'empresa' ? sessao.perfil.id : 0;
  }

  protected carregarVagas(): void {
    this.carregando.set(true);
    this.erro.set(null);

    this.vagaService.listar(this.idEmpresaLogada()).subscribe({
      next: (vagas) => {
        this.vagas.set(vagas);
        this.carregando.set(false);
      },
      error: () => {
        this.erro.set('Não foi possível carregar as vagas. Tente novamente.');
        this.carregando.set(false);
      }
    });
  }

  protected excluirVaga(vaga: Vaga): void {
    const confirmou = confirm(`Excluir a vaga "${vaga.titulo}"? Essa ação não pode ser desfeita.`);
    if (!confirmou) {
      return;
    }

    this.excluindoId.set(vaga.id);
    this.erro.set(null);

    this.vagaService.remover(vaga.id, this.idEmpresaLogada()).subscribe({
      next: () => {
        this.vagas.update((lista) => lista.filter((item) => item.id !== vaga.id));
        this.excluindoId.set(null);
      },
      error: () => {
        this.erro.set('Não foi possível excluir a vaga. Tente novamente.');
        this.excluindoId.set(null);
      }
    });
  }

  protected aoClicarCadastrarVaga(): void {
    this.roteador.navigate(['/empresa/vagas/nova']);
  }

  protected aoClicarDetalhes(vaga: Vaga): void {
    // TODO: navegar para a tela de detalhes e inscritos quando ela existir.
    console.log('detalhes da vaga', vaga.id);
  }

  protected formatarLocalizacao(vaga: Vaga): string {
    return formatarLocalizacaoVaga(vaga);
  }

  protected formatarSalario(vaga: Vaga): string | null {
    return formatarSalarioVaga(vaga);
  }
}
