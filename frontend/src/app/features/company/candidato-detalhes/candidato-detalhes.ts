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

  /**
   * Quando se chega aqui a partir da tela de uma vaga (inscritos), o id dela
   * vem na query string — é para lá que o "Voltar" deve mandar a empresa, em
   * vez da lista geral de candidatos, que é a origem padrão (ex.: menu lateral).
   */
  private readonly idVagaOrigem: number | null;

  /** Rótulo do botão "Voltar" reflete pra onde ele realmente vai, em vez de um texto genérico. */
  protected readonly textoVoltar: string;

  constructor() {
    const idCandidato = Number(this.rota.snapshot.paramMap.get('id'));
    const origemVaga = this.rota.snapshot.queryParamMap.get('origemVaga');
    this.idVagaOrigem = origemVaga !== null ? Number(origemVaga) : null;
    this.textoVoltar = this.idVagaOrigem !== null ? 'Voltar para a vaga' : 'Voltar para candidatos';

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
    if (this.idVagaOrigem !== null) {
      this.roteador.navigate(['/empresa/vagas', this.idVagaOrigem]);
      return;
    }

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
