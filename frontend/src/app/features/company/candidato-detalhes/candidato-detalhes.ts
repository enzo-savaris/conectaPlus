import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../../../shared/services/auth.service';
import { UsuarioService } from '../../../shared/services/usuario.service';
import { PerfilCandidato } from '../../../shared/types/candidato';
import { formatarTipoDeficiencia } from '../../../shared/utils/candidato-format';

/** Tela de detalhes do candidato: perfil completo de alguém inscrito numa vaga da empresa. */
@Component({
  selector: 'app-candidato-detalhes',
  templateUrl: './candidato-detalhes.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CandidatoDetalhes {
  private readonly rota = inject(ActivatedRoute);
  private readonly roteador = inject(Router);
  private readonly usuarioService = inject(UsuarioService);
  private readonly authService = inject(AuthService);

  protected readonly candidato = signal<PerfilCandidato | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);

  constructor() {
    const idCandidato = Number(this.rota.snapshot.paramMap.get('id'));
    this.carregar(idCandidato);
  }

  /** Garantido pelo ambienteGuard('empresa'): só entra aqui quem está logado como empresa. */
  private idEmpresaLogada(): number {
    const sessao = this.authService.sessao();
    return sessao?.ambiente === 'empresa' ? sessao.perfil.id : 0;
  }

  private carregar(idCandidato: number): void {
    this.carregando.set(true);
    this.erro.set(null);

    this.usuarioService.obterPorId(idCandidato, this.idEmpresaLogada()).subscribe({
      next: (candidato) => {
        this.candidato.set(candidato);
        this.carregando.set(false);
      },
      error: () => {
        this.erro.set('Não foi possível carregar esse candidato. Ele pode não estar mais inscrito em nenhuma vaga sua.');
        this.carregando.set(false);
      }
    });
  }

  protected aoClicarVoltar(): void {
    this.roteador.navigate(['/empresa/candidatos']);
  }

  protected formatarLocalizacao(candidato: PerfilCandidato): string | null {
    const partes = [candidato.cidade, candidato.estado].filter((parte): parte is string => !!parte);
    return partes.length > 0 ? partes.join(' - ') : null;
  }

  protected formatarTipoDeficiencia(candidato: PerfilCandidato): string {
    return formatarTipoDeficiencia(candidato.tipoDeficiencia);
  }
}
