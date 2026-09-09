import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { AuthService } from '../../shared/services/auth.service';
import { EmpresaService } from '../../shared/services/empresa.service';
import { CandidatoRelacionado, TipoDeficiencia } from '../../shared/types/candidato';

/**
 * Tela de candidatos: todos os PCDs já inscritos em alguma vaga da empresa
 * logada, sem repetir — não importa em qual vaga. Dados reais, vindos do banco.
 */
@Component({
  selector: 'app-candidatos',
  templateUrl: './candidatos.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Candidatos {
  private readonly empresaService = inject(EmpresaService);
  private readonly authService = inject(AuthService);

  protected readonly candidatos = signal<CandidatoRelacionado[]>([]);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);

  constructor() {
    this.carregarCandidatos();
  }

  /** Garantido pelo ambienteGuard('empresa'): só entra aqui quem está logado como empresa. */
  private idEmpresaLogada(): number {
    const sessao = this.authService.sessao();
    return sessao?.ambiente === 'empresa' ? sessao.perfil.id : 0;
  }

  private carregarCandidatos(): void {
    this.carregando.set(true);
    this.erro.set(null);

    this.empresaService.listarCandidatos(this.idEmpresaLogada()).subscribe({
      next: (candidatos) => {
        this.candidatos.set(candidatos);
        this.carregando.set(false);
      },
      error: () => {
        this.erro.set('Não foi possível carregar os candidatos. Tente novamente.');
        this.carregando.set(false);
      }
    });
  }

  protected formatarLocalizacao(candidato: CandidatoRelacionado): string | null {
    const partes = [candidato.cidade, candidato.estado].filter((parte): parte is string => !!parte);
    return partes.length > 0 ? partes.join(' - ') : null;
  }

  protected formatarTipoDeficiencia(tipo: TipoDeficiencia): string {
    switch (tipo) {
      case 'FISICA':
        return 'Deficiência física';
      case 'AUDITIVA':
        return 'Deficiência auditiva';
      case 'VISUAL':
        return 'Deficiência visual';
      case 'INTELECTUAL':
        return 'Deficiência intelectual';
      case 'MULTIPLA':
        return 'Deficiência múltipla';
      default:
        return 'Outra deficiência';
    }
  }
}
