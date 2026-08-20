import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { AuthService } from '../../../shared/services/auth.service';
import { PainelEmpresaService } from '../../../shared/services/painel-empresa.service';
import { VagaService } from '../../../shared/services/vaga.service';
import { ResumoPainelEmpresa } from '../../../shared/types/painel-empresa';
import { Vaga } from '../../../shared/types/vaga';
import { formatarLocalizacaoVaga, formatarSalarioVaga } from '../../../shared/utils/vaga-format';

/** Quantidade de vagas exibidas na seção "Vagas recentes". */
const QUANTIDADE_VAGAS_RECENTES = 5;

/** Tela inicial do ambiente da empresa: resumo de vagas, cursos e inscrições, vindos do banco. */
@Component({
  selector: 'app-painel-empresa',
  imports: [RouterLink],
  templateUrl: './painel-empresa.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PainelEmpresa {
  private readonly painelService = inject(PainelEmpresaService);
  private readonly vagaService = inject(VagaService);
  private readonly authService = inject(AuthService);
  private readonly roteador = inject(Router);

  protected readonly resumo = signal<ResumoPainelEmpresa | null>(null);
  protected readonly vagasRecentes = signal<Vaga[]>([]);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);

  constructor() {
    this.carregarPainel();
  }

  /** Garantido pelo ambienteGuard('empresa'): só entra aqui quem está logado como empresa. */
  private idEmpresaLogada(): number {
    const sessao = this.authService.sessao();
    return sessao?.ambiente === 'empresa' ? sessao.perfil.id : 0;
  }

  protected carregarPainel(): void {
    this.carregando.set(true);
    this.erro.set(null);

    const idEmpresa = this.idEmpresaLogada();

    forkJoin({
      resumo: this.painelService.obterResumo(idEmpresa),
      vagas: this.vagaService.listar(idEmpresa)
    }).subscribe({
      next: ({ resumo, vagas }) => {
        this.resumo.set(resumo);
        this.vagasRecentes.set(vagas.slice(0, QUANTIDADE_VAGAS_RECENTES));
        this.carregando.set(false);
      },
      error: () => {
        this.erro.set('Não foi possível carregar o painel. Tente novamente.');
        this.carregando.set(false);
      }
    });
  }

  protected aoClicarCadastrarVaga(): void {
    this.roteador.navigate(['/empresa/vagas/nova']);
  }

  protected formatarLocalizacao(vaga: Vaga): string {
    return formatarLocalizacaoVaga(vaga);
  }

  protected formatarSalario(vaga: Vaga): string | null {
    return formatarSalarioVaga(vaga);
  }
}
