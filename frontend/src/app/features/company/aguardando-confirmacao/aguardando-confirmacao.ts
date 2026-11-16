import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { EMAIL_SUPORTE } from '../../../shared/config/suporte';
import { EmpresaService } from '../../../shared/services/empresa.service';
import { SituacaoCadastroEmpresa } from '../../../shared/types/empresa';

/** De quanto em quanto tempo a tela pergunta se a equipe já decidiu. */
const INTERVALO_CONSULTA_MS = 15_000;

/**
 * Tela intermediária, sem sidebar, exibida depois do cadastro de empresa e
 * quando uma empresa PENDENTE tenta logar: ninguém acessa a plataforma
 * enquanto a existência da empresa não é confirmada manualmente.
 *
 * Com o CNPJ na URL (?cnpj=), consulta a situação de tempos em tempos: assim
 * que a equipe aprova, a tela mostra "Empresa aprovada" e leva ao login com
 * o CNPJ preenchido; se recusar, mostra o motivo.
 */
@Component({
  selector: 'app-aguardando-confirmacao',
  imports: [],
  templateUrl: './aguardando-confirmacao.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AguardandoConfirmacao {
  private readonly roteador = inject(Router);
  private readonly empresaService = inject(EmpresaService);

  protected readonly emailSuporte = EMAIL_SUPORTE;
  protected readonly linkSuporte = `mailto:${EMAIL_SUPORTE}`;

  private readonly cnpj = inject(ActivatedRoute).snapshot.queryParamMap.get('cnpj');

  protected readonly situacao = signal<SituacaoCadastroEmpresa | null>(null);
  protected readonly verificando = signal(false);

  protected readonly aprovada = computed(() => this.situacao()?.status === 'ATIVA');
  protected readonly recusada = computed(() => this.situacao()?.status === 'RECUSADA');
  protected readonly inativa = computed(() => this.situacao()?.status === 'INATIVA');
  /** Sem decisão ainda (ou sem CNPJ para consultar): a tela de espera de sempre. */
  protected readonly emAnalise = computed(() => !this.aprovada() && !this.recusada() && !this.inativa());

  constructor() {
    if (!this.cnpj) {
      return;
    }

    this.verificar();
    const intervalo = setInterval(() => {
      if (this.emAnalise()) {
        this.verificar();
      }
    }, INTERVALO_CONSULTA_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(intervalo));
  }

  protected readonly podeVerificar = !!this.cnpj;

  protected verificar(): void {
    if (!this.cnpj || this.verificando()) {
      return;
    }

    this.verificando.set(true);
    this.empresaService.consultarSituacao(this.cnpj).subscribe({
      next: (situacao) => {
        this.situacao.set(situacao);
        this.verificando.set(false);
      },
      // Falha de rede: continua mostrando "em análise" e tenta de novo no próximo ciclo.
      error: () => this.verificando.set(false)
    });
  }

  protected aoEntrar(): void {
    this.roteador.navigate(['/login'], { queryParams: { documento: this.cnpj } });
  }

  protected aoVoltar(): void {
    this.roteador.navigate(['/login']);
  }
}
