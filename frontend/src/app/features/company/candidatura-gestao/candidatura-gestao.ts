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
  formatarSalario,
  formatarStatusCandidatura,
  processoEncerrado
} from '../../../shared/utils/candidatura-format';

/** Formulário aberto no card de "Próxima ação". */
type Painel = 'entrevista' | 'registro' | 'proposta' | 'reprovar' | null;

interface EtapaLinhaDoTempo {
  titulo: string;
  data: string | null;
  situacao: 'concluida' | 'atual' | 'pendente' | 'encerrada';
}

/** O que a tela sugere como próximo passo em cada etapa. */
interface ProximoPasso {
  texto: string;
  /** Ação principal (botão em destaque). */
  principal: { painel: Exclude<Painel, null> | 'analise'; rotulo: string } | null;
  /** Ações secundárias. */
  secundarias: { painel: Exclude<Painel, null>; rotulo: string }[];
}

/**
 * Tela da empresa para conduzir o processo seletivo de uma candidatura, do
 * recebimento à contratação:
 *
 *   Recebida → Análise → Entrevista (agendar) → Entrevista realizada
 *   (registrar como foi) → Proposta (salário, início, condições) →
 *   Contratado, quando o candidato aceita a proposta pela plataforma.
 *
 * Em cada etapa o card "Próximo passo" diz o que fazer em seguida. Encerrar
 * o processo é possível em qualquer ponto até a resposta do candidato.
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
  protected readonly compareceu = signal(true);
  protected readonly notasEntrevista = signal('');
  protected readonly salarioProposta = signal('');
  protected readonly dataInicio = signal('');
  protected readonly detalhesProposta = signal('');
  protected readonly validadeProposta = signal('');
  protected readonly mensagem = signal('');

  /** Só empresa ATIVA pode mexer no processo; as outras só visualizam (mesma regra das vagas). */
  protected readonly empresaAtiva = computed(() => {
    const sessao = this.authService.sessao();
    return sessao?.ambiente !== 'empresa' || sessao.perfil.status === 'ATIVA';
  });

  protected readonly agoraLocal = this.paraDataHoraLocal(new Date());
  protected readonly hoje = new Date().toISOString().slice(0, 10);

  protected readonly encerrado = computed(() => {
    const c = this.candidatura();
    return c ? processoEncerrado(c.status) : false;
  });

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

  /** Próximo passo sugerido para a etapa atual. */
  protected readonly proximoPasso = computed<ProximoPasso | null>(() => {
    switch (this.candidatura()?.status) {
      case 'PENDENTE':
        return {
          texto: 'Candidatura nova. Ao iniciar a análise, o candidato vê no portal que o currículo está sendo avaliado.',
          principal: { painel: 'analise', rotulo: 'Iniciar análise' },
          secundarias: [{ painel: 'reprovar', rotulo: 'Encerrar candidatura' }]
        };
      case 'EM_ANALISE':
        return {
          texto: 'Currículo em análise. Próximo passo: agendar uma entrevista acessível. Se a entrevista não for necessária, você pode enviar a proposta direto.',
          principal: { painel: 'entrevista', rotulo: 'Agendar entrevista' },
          secundarias: [
            { painel: 'proposta', rotulo: 'Enviar proposta sem entrevista' },
            { painel: 'reprovar', rotulo: 'Encerrar candidatura' }
          ]
        };
      case 'ENTREVISTA':
        return {
          texto: 'Entrevista agendada. Próximo passo: depois que ela acontecer, registre como foi — só então a proposta fica disponível.',
          principal: { painel: 'registro', rotulo: 'Registrar entrevista realizada' },
          secundarias: [
            { painel: 'entrevista', rotulo: 'Reagendar' },
            { painel: 'reprovar', rotulo: 'Encerrar candidatura' }
          ]
        };
      case 'ENTREVISTA_REALIZADA':
        return {
          texto: this.candidatura()?.compareceu === false
            ? 'O candidato não compareceu. Você pode reagendar a entrevista ou encerrar o processo.'
            : 'Entrevista registrada. Próximo passo: enviar a proposta de contratação — o candidato aceita ou recusa pela plataforma.',
          principal:
            this.candidatura()?.compareceu === false
              ? { painel: 'entrevista', rotulo: 'Reagendar entrevista' }
              : { painel: 'proposta', rotulo: 'Enviar proposta' },
          secundarias: [
            ...(this.candidatura()?.compareceu === false
              ? [{ painel: 'proposta' as const, rotulo: 'Enviar proposta mesmo assim' }]
              : [{ painel: 'entrevista' as const, rotulo: 'Agendar nova entrevista' }]),
            { painel: 'reprovar', rotulo: 'Encerrar candidatura' }
          ]
        };
      case 'PROPOSTA':
        return {
          texto: 'Proposta enviada. Aguardando o candidato aceitar ou recusar pela plataforma — ao aceitar, a contratação é concluída automaticamente.',
          principal: null,
          secundarias: [{ painel: 'reprovar', rotulo: 'Retirar proposta e encerrar' }]
        };
      default:
        return null;
    }
  });

  protected readonly linhaDoTempo = computed<EtapaLinhaDoTempo[]>(() => {
    const c = this.candidatura();
    if (!c) {
      return [];
    }

    const dataDe = (...status: StatusCandidatura[]): string | null =>
      [...c.historico].reverse().find((item) => status.includes(item.status))?.data ?? null;

    const ordem: StatusCandidatura[] = ['PENDENTE', 'EM_ANALISE', 'ENTREVISTA', 'ENTREVISTA_REALIZADA', 'PROPOSTA', 'APROVADO'];
    // Etapa "visual" atual: entrevista agendada e realizada são a mesma coluna.
    const posicao = (status: StatusCandidatura): number => {
      const indice = ordem.indexOf(status);
      return indice >= 3 ? indice - 1 : indice;
    };
    const atingida = Math.max(...c.historico.map((item) => posicao(item.status)).filter((i) => i >= 0), 0);
    const atual = processoEncerrado(c.status) ? -1 : posicao(c.status);

    const situacao = (indice: number): EtapaLinhaDoTempo['situacao'] => {
      if (indice === atual) return 'atual';
      if (indice <= atingida) return 'concluida';
      return processoEncerrado(c.status) ? 'encerrada' : 'pendente';
    };

    return [
      { titulo: 'Recebida', data: c.dataCandidatura, situacao: situacao(0) },
      { titulo: 'Análise', data: dataDe('EM_ANALISE'), situacao: situacao(1) },
      { titulo: 'Entrevista', data: dataDe('ENTREVISTA_REALIZADA', 'ENTREVISTA'), situacao: situacao(2) },
      { titulo: 'Proposta', data: dataDe('PROPOSTA'), situacao: situacao(3) },
      {
        titulo: c.status === 'REPROVADO' ? 'Não selecionado' : c.status === 'DESISTIU' ? 'Recusou a proposta' : 'Contratado',
        data: dataDe('APROVADO', 'REPROVADO', 'DESISTIU'),
        situacao: c.status === 'APROVADO' ? 'concluida' : processoEncerrado(c.status) ? 'encerrada' : 'pendente'
      }
    ];
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

  protected acionar(painel: Exclude<Painel, null> | 'analise'): void {
    if (painel === 'analise') {
      this.executar({ acao: 'INICIAR_ANALISE' }, 'Análise iniciada. O candidato já pode acompanhar.');
      return;
    }
    this.abrirPainel(painel);
  }

  private abrirPainel(painel: Exclude<Painel, null>): void {
    const c = this.candidatura();
    this.erroAcao.set(null);
    this.errosCampos.set({});
    this.mensagem.set('');

    if (painel === 'entrevista' && c) {
      if (c.entrevista && c.status === 'ENTREVISTA') {
        // Reagendar: o formulário já vem com a entrevista atual.
        this.dataEntrevista.set(this.paraDataHoraLocal(new Date(c.entrevista.data)));
        this.formatoEntrevista.set(c.entrevista.formato);
        this.localEntrevista.set(c.entrevista.local);
        this.observacoesEntrevista.set(c.entrevista.observacoes ?? '');
      } else {
        this.dataEntrevista.set('');
        // Sugere o formato que o candidato pediu, ou o da própria vaga.
        this.formatoEntrevista.set(
          c.adaptacoes.entrevistaRemota || c.modeloTrabalho === 'REMOTO' ? 'REMOTA' : (c.entrevista?.formato ?? 'PRESENCIAL')
        );
        this.localEntrevista.set(c.entrevista?.local ?? '');
        this.observacoesEntrevista.set('');
      }
    }

    if (painel === 'registro') {
      this.compareceu.set(true);
      this.notasEntrevista.set('');
    }

    if (painel === 'proposta') {
      this.salarioProposta.set('');
      this.dataInicio.set('');
      this.detalhesProposta.set('');
      this.validadeProposta.set('');
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

  protected registrarEntrevista(): void {
    this.executar(
      { acao: 'REGISTRAR_ENTREVISTA', compareceu: this.compareceu(), notas: this.notasEntrevista() },
      this.compareceu() ? 'Entrevista registrada. Agora você pode enviar a proposta.' : 'Ausência registrada.'
    );
  }

  protected enviarProposta(): void {
    this.executar(
      {
        acao: 'ENVIAR_PROPOSTA',
        salario: this.salarioProposta(),
        dataInicio: this.dataInicio(),
        detalhes: this.detalhesProposta(),
        validade: this.validadeProposta(),
        mensagem: this.mensagem()
      },
      'Proposta enviada! O candidato vai aceitar ou recusar pela plataforma.'
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

  protected formatarSalario(valor: number): string {
    return formatarSalario(valor);
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
