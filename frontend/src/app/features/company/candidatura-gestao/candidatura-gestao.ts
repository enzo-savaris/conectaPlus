import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthService } from '../../../shared/services/auth.service';
import { CandidaturaService } from '../../../shared/services/candidatura.service';
import { ToastService } from '../../../shared/services/toast.service';
import { TipoDeficiencia } from '../../../shared/types/candidato';
import {
  AcaoCandidatura,
  CandidaturaGestao,
  FormatoEntrevista,
  StatusCandidatura
} from '../../../shared/types/vaga';
import { formatarTipoDeficiencia } from '../../../shared/utils/candidato-format';
import {
  corStatusCandidatura,
  formatarDataEntrevista,
  formatarDataHora,
  formatarDataSimples,
  formatarFormatoEntrevista,
  formatarStatusCandidatura
} from '../../../shared/utils/candidatura-format';

/** Formulário aberto no card de "Próxima ação". */
type Painel = 'entrevista' | 'contratar' | 'reprovar' | null;

interface EtapaLinhaDoTempo {
  titulo: string;
  data: string | null;
  situacao: 'concluida' | 'atual' | 'pendente' | 'encerrada';
}

/**
 * Tela da empresa para conduzir o processo seletivo de uma candidatura:
 * vê tudo que o candidato enviou e avança as etapas — iniciar a análise,
 * agendar (ou reagendar) a entrevista acessível, contratar ou encerrar. Cada
 * passo aparece na tela de acompanhamento do candidato.
 */
@Component({
  selector: 'app-candidatura-gestao',
  imports: [RouterLink],
  templateUrl: './candidatura-gestao.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GerenciarCandidatura {
  private readonly rota = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly candidaturaService = inject(CandidaturaService);
  private readonly toastService = inject(ToastService);

  protected readonly candidatura = signal<CandidaturaGestao | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);

  protected readonly painel = signal<Painel>(null);
  protected readonly salvando = signal(false);
  protected readonly erroAcao = signal<string | null>(null);
  protected readonly errosCampos = signal<Record<string, string>>({});

  // Campos dos formulários de ação.
  protected readonly dataEntrevista = signal('');
  protected readonly formatoEntrevista = signal<FormatoEntrevista>('REMOTA');
  protected readonly localEntrevista = signal('');
  protected readonly observacoesEntrevista = signal('');
  protected readonly dataInicio = signal('');
  protected readonly mensagem = signal('');

  /** Só empresa ATIVA pode mexer no processo; as outras só visualizam (mesma regra das vagas). */
  protected readonly empresaAtiva = computed(() => {
    const sessao = this.authService.sessao();
    return sessao?.ambiente !== 'empresa' || sessao.perfil.status === 'ATIVA';
  });

  /** Não dá pra agendar a entrevista pro passado; o input já bloqueia as datas anteriores a agora. */
  protected readonly agoraLocal = this.paraDataHoraLocal(new Date());

  protected readonly adaptacoesPedidas = computed(() => {
    const c = this.candidatura();
    if (!c) {
      return [];
    }

    return [
      c.adaptacoes.entrevistaRemota ? 'Entrevista 100% remota' : null,
      c.adaptacoes.tempoEstendido ? 'Tempo estendido em testes' : null,
      c.adaptacoes.interpreteLibras ? 'Intérprete de Libras' : null
    ].filter((item): item is string => item !== null);
  });

  protected readonly linhaDoTempo = computed<EtapaLinhaDoTempo[]>(() => {
    const c = this.candidatura();
    if (!c) {
      return [];
    }

    const dataDe = (status: StatusCandidatura): string | null =>
      [...c.historico].reverse().find((item) => item.status === status)?.data ?? null;

    const ordem: StatusCandidatura[] = ['PENDENTE', 'EM_ANALISE', 'ENTREVISTA'];
    const final = c.status === 'APROVADO' || c.status === 'REPROVADO';
    const indiceAtual = final ? ordem.length : ordem.indexOf(c.status);

    const etapas: EtapaLinhaDoTempo[] = [
      { titulo: 'Recebida', data: c.dataCandidatura, situacao: 'concluida' },
      {
        titulo: 'Análise',
        data: dataDe('EM_ANALISE'),
        situacao: indiceAtual > 1 ? 'concluida' : indiceAtual === 1 ? 'atual' : 'pendente'
      },
      {
        titulo: 'Entrevista',
        data: dataDe('ENTREVISTA'),
        situacao: dataDe('ENTREVISTA') && final ? 'concluida' : c.status === 'ENTREVISTA' ? 'atual' : final ? 'encerrada' : 'pendente'
      },
      {
        titulo: c.status === 'APROVADO' ? 'Contratado' : c.status === 'REPROVADO' ? 'Não selecionado' : 'Resultado',
        data: final ? dataDe(c.status) : null,
        situacao: c.status === 'APROVADO' ? 'concluida' : c.status === 'REPROVADO' ? 'encerrada' : 'pendente'
      }
    ];

    // Candidatura nova (PENDENTE): a etapa atual é a própria "Recebida", aguardando análise.
    if (c.status === 'PENDENTE') {
      etapas[0].situacao = 'atual';
    }

    return etapas;
  });

  private readonly idCandidatura = Number(this.rota.snapshot.paramMap.get('id'));

  constructor() {
    this.carregar();
  }

  private idEmpresaLogada(): number {
    const sessao = this.authService.sessao();
    // Garantido pelo ambienteGuard('empresa').
    return sessao?.ambiente === 'empresa' ? sessao.perfil.id : 0;
  }

  private carregar(): void {
    this.candidaturaService.obter(this.idCandidatura, this.idEmpresaLogada()).subscribe({
      next: (candidatura) => {
        this.candidatura.set(candidatura);
        this.carregando.set(false);
      },
      error: () => {
        this.erro.set('Não foi possível carregar essa candidatura. Ela pode não pertencer a uma vaga sua.');
        this.carregando.set(false);
      }
    });
  }

  protected abrirPainel(painel: Exclude<Painel, null>): void {
    const c = this.candidatura();
    this.erroAcao.set(null);
    this.errosCampos.set({});
    this.mensagem.set('');

    if (painel === 'entrevista' && c) {
      if (c.entrevista) {
        // Reagendar: o formulário já vem com a entrevista atual.
        this.dataEntrevista.set(this.paraDataHoraLocal(new Date(c.entrevista.data)));
        this.formatoEntrevista.set(c.entrevista.formato);
        this.localEntrevista.set(c.entrevista.local);
        this.observacoesEntrevista.set(c.entrevista.observacoes ?? '');
      } else {
        this.dataEntrevista.set('');
        // Sugere o formato que o candidato pediu, ou o da própria vaga.
        this.formatoEntrevista.set(
          c.adaptacoes.entrevistaRemota || c.modeloTrabalho === 'REMOTO' ? 'REMOTA' : 'PRESENCIAL'
        );
        this.localEntrevista.set('');
        this.observacoesEntrevista.set('');
      }
    }

    if (painel === 'contratar') {
      this.dataInicio.set('');
    }

    this.painel.set(painel);
  }

  protected fecharPainel(): void {
    this.painel.set(null);
    this.erroAcao.set(null);
    this.errosCampos.set({});
  }

  protected valorDe(evento: Event): string {
    return (evento.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  protected iniciarAnalise(): void {
    this.executar({ acao: 'INICIAR_ANALISE' }, 'Análise iniciada. O candidato já pode acompanhar.');
  }

  protected agendarEntrevista(): void {
    const reagendando = this.candidatura()?.status === 'ENTREVISTA';

    this.executar(
      {
        acao: 'AGENDAR_ENTREVISTA',
        dataEntrevista: this.dataEntrevista(),
        formatoEntrevista: this.formatoEntrevista(),
        localEntrevista: this.localEntrevista(),
        observacoesEntrevista: this.observacoesEntrevista()
      },
      reagendando ? 'Entrevista reagendada.' : 'Entrevista agendada. O candidato verá os detalhes no portal.'
    );
  }

  protected contratar(): void {
    this.executar(
      { acao: 'CONTRATAR', dataInicio: this.dataInicio(), mensagem: this.mensagem() },
      'Contratação registrada!'
    );
  }

  protected reprovar(): void {
    this.executar({ acao: 'REPROVAR', mensagem: this.mensagem() }, 'Candidatura encerrada.');
  }

  private executar(acao: AcaoCandidatura, mensagemSucesso: string): void {
    this.salvando.set(true);
    this.erroAcao.set(null);
    this.errosCampos.set({});

    this.candidaturaService.alterarEtapa(this.idCandidatura, this.idEmpresaLogada(), acao).subscribe({
      next: (candidatura) => {
        this.candidatura.set(candidatura);
        this.salvando.set(false);
        this.painel.set(null);
        this.toastService.sucesso(mensagemSucesso);
      },
      error: (erro: HttpErrorResponse) => {
        this.salvando.set(false);
        const corpo = erro.error as { mensagem?: string; erros?: Record<string, string> } | null;

        if (erro.status === 422 && corpo?.erros) {
          this.errosCampos.set(corpo.erros);
          this.erroAcao.set('Revise os campos destacados.');
          return;
        }

        this.erroAcao.set(corpo?.mensagem ?? 'Não foi possível atualizar a candidatura. Tente novamente.');
      }
    });
  }

  /** Formato aceito pelo <input type="datetime-local">, no fuso do navegador. */
  private paraDataHoraLocal(data: Date): string {
    const local = new Date(data.getTime() - data.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  protected formatarStatus(status: StatusCandidatura): string {
    return formatarStatusCandidatura(status, 'empresa');
  }

  protected corStatus(status: StatusCandidatura): string {
    return corStatusCandidatura(status);
  }

  protected formatarDataHora(data: string): string {
    return formatarDataHora(data);
  }

  protected formatarDataEntrevista(data: string): string {
    return formatarDataEntrevista(data);
  }

  protected formatarDataSimples(data: string): string {
    return formatarDataSimples(data);
  }

  protected formatarFormato(formato: FormatoEntrevista): string {
    return formatarFormatoEntrevista(formato);
  }

  protected formatarDeficiencia(tipo: string): string {
    return formatarTipoDeficiencia(tipo as TipoDeficiencia);
  }

  /** Link de chamada vira um link clicável; endereço fica como texto. */
  protected ehLink(local: string): boolean {
    return /^https?:\/\//i.test(local);
  }
}
