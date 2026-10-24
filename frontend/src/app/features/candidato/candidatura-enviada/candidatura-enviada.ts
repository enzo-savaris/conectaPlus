import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { EMAIL_SUPORTE } from '../../../shared/config/suporte';
import { AuthService } from '../../../shared/services/auth.service';
import { ToastService } from '../../../shared/services/toast.service';
import { VagaService } from '../../../shared/services/vaga.service';
import {
  AcompanhamentoCandidatura,
  AdaptacoesCandidatura,
  EntrevistaAgendada,
  PropostaContratacao,
  StatusCandidatura
} from '../../../shared/types/vaga';
import {
  formatarDataEntrevista,
  formatarDataHora,
  formatarDataSimples,
  formatarFormatoEntrevista,
  formatarSalario
} from '../../../shared/utils/candidatura-format';

type SituacaoEtapa = 'concluida' | 'atual' | 'pendente' | 'encerrada';

interface EtapaProcesso {
  titulo: string;
  detalhe: string;
  situacao: SituacaoEtapa;
  icone: 'check' | 'olho' | 'conversa' | 'documento' | 'medalha';
  /** Só na etapa de entrevista, enquanto agendada. */
  entrevista?: EntrevistaAgendada;
  /** Só na etapa de proposta. */
  proposta?: PropostaContratacao;
  /** Mensagem da empresa (na proposta ou no encerramento). */
  mensagem?: string | null;
}

/** Texto do selo "Estágio atual" no topo da tela. */
const ESTAGIO_ATUAL: Record<StatusCandidatura, string> = {
  PENDENTE: 'Candidatura recebida',
  EM_ANALISE: 'Análise de currículo',
  ENTREVISTA: 'Entrevista agendada',
  ENTREVISTA_REALIZADA: 'Entrevista realizada',
  PROPOSTA: 'Proposta recebida — sua resposta',
  APROVADO: 'Contratação confirmada',
  REPROVADO: 'Processo encerrado',
  DESISTIU: 'Proposta recusada'
};

/**
 * Confirmação depois do envio da candidatura, que também serve de tela de
 * acompanhamento: a linha do tempo é montada a partir do status que a empresa
 * vai atualizando na tela "Gerenciar candidatura". Quando a empresa envia a
 * proposta, é aqui que o candidato aceita (e é contratado) ou recusa.
 */
@Component({
  selector: 'app-candidatura-enviada',
  imports: [RouterLink],
  templateUrl: './candidatura-enviada.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CandidaturaEnviada {
  private readonly rota = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly vagaService = inject(VagaService);
  private readonly toastService = inject(ToastService);

  protected readonly linkSuporte = `mailto:${EMAIL_SUPORTE}`;

  protected readonly candidatura = signal<AcompanhamentoCandidatura | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);

  // Resposta à proposta
  protected readonly recusando = signal(false);
  protected readonly motivoRecusa = signal('');
  protected readonly respondendo = signal(false);
  protected readonly erroResposta = signal<string | null>(null);

  protected readonly opcoesAdaptacao: { chave: keyof AdaptacoesCandidatura; rotulo: string }[] = [
    { chave: 'entrevistaRemota', rotulo: 'Entrevista 100% remota' },
    { chave: 'tempoEstendido', rotulo: 'Tempo estendido em testes' },
    { chave: 'interpreteLibras', rotulo: 'Intérprete de Libras' }
  ];

  private readonly idVaga = Number(this.rota.snapshot.paramMap.get('id'));

  protected readonly estagioAtual = computed(() => {
    const candidatura = this.candidatura();
    return candidatura ? ESTAGIO_ATUAL[candidatura.status] : '';
  });

  /** A proposta ainda pode ser respondida (status PROPOSTA e dentro do prazo). */
  protected readonly propostaAberta = computed(() => {
    const c = this.candidatura();
    if (c?.status !== 'PROPOSTA') {
      return false;
    }
    const validade = c.proposta?.validade;
    return !validade || validade >= new Date().toISOString().slice(0, 10);
  });

  protected readonly etapas = computed<EtapaProcesso[]>(() => {
    const c = this.candidatura();
    if (!c) {
      return [];
    }

    /** Quando a candidatura entrou na etapa, segundo o histórico. */
    const quando = (...status: StatusCandidatura[]): string | null => {
      const data = [...c.historico].reverse().find((item) => status.includes(item.status))?.data;
      return data ? formatarDataHora(data) : null;
    };
    const passou = (...status: StatusCandidatura[]) => c.historico.some((item) => status.includes(item.status));
    const encerrado = c.status === 'REPROVADO' || c.status === 'DESISTIU' || c.status === 'APROVADO';

    const recebida: EtapaProcesso = {
      titulo: 'Candidatura recebida',
      detalhe: `${formatarDataHora(c.dataCandidatura)} · Enviado com sucesso`,
      situacao: 'concluida',
      icone: 'check'
    };

    const analise: EtapaProcesso =
      c.status === 'PENDENTE'
        ? { titulo: 'Análise de currículo', detalhe: 'Aguardando a empresa · Retorno estimado em até 3 dias úteis', situacao: 'atual', icone: 'olho' }
        : c.status === 'EM_ANALISE'
          ? {
              titulo: 'Análise de currículo',
              detalhe: `Em andamento${quando('EM_ANALISE') ? ' desde ' + quando('EM_ANALISE')!.toLowerCase() : ''}`,
              situacao: 'atual',
              icone: 'olho'
            }
          : { titulo: 'Análise de currículo', detalhe: 'Concluída', situacao: 'concluida', icone: 'olho' };

    let entrevista: EtapaProcesso;
    if (c.status === 'ENTREVISTA' && c.entrevista) {
      entrevista = {
        titulo: 'Entrevista acessível',
        detalhe: `Agendada · ${formatarDataEntrevista(c.entrevista.data)}`,
        situacao: 'atual',
        icone: 'conversa',
        entrevista: c.entrevista
      };
    } else if (c.status === 'ENTREVISTA_REALIZADA') {
      entrevista = {
        titulo: 'Entrevista acessível',
        detalhe:
          c.compareceu === false
            ? 'A empresa registrou que a entrevista não aconteceu. Ela pode reagendar — fique de olho por aqui.'
            : 'Realizada · A empresa está avaliando e vai dar o retorno por aqui',
        situacao: 'atual',
        icone: 'conversa'
      };
    } else if (passou('ENTREVISTA_REALIZADA', 'ENTREVISTA') && c.entrevista) {
      entrevista = {
        titulo: 'Entrevista acessível',
        detalhe: `Realizada · ${formatarDataEntrevista(c.entrevista.data)}`,
        situacao: 'concluida',
        icone: 'conversa'
      };
    } else if (passou('PROPOSTA') || encerrado) {
      entrevista = {
        titulo: 'Entrevista acessível',
        detalhe: passou('PROPOSTA') ? 'Não foi necessária' : 'Não realizada',
        situacao: 'pendente',
        icone: 'conversa'
      };
    } else {
      entrevista = {
        titulo: 'Entrevista acessível',
        detalhe: 'Pendente · Será agendada por aqui no portal Conecta+',
        situacao: 'pendente',
        icone: 'conversa'
      };
    }

    let proposta: EtapaProcesso;
    if (c.status === 'PROPOSTA' && c.proposta) {
      proposta = {
        titulo: 'Proposta de contratação',
        detalhe: c.proposta.validade
          ? `Recebida ${quando('PROPOSTA')?.toLowerCase() ?? ''} · Responda até ${formatarDataSimples(c.proposta.validade)}`
          : `Recebida ${quando('PROPOSTA')?.toLowerCase() ?? ''} · Aguardando a sua resposta`,
        situacao: 'atual',
        icone: 'documento',
        proposta: c.proposta,
        mensagem: c.mensagemEmpresa
      };
    } else if ((c.status === 'APROVADO' || c.status === 'DESISTIU') && c.proposta) {
      proposta = {
        titulo: 'Proposta de contratação',
        detalhe: c.status === 'APROVADO' ? 'Aceita por você' : 'Recusada por você',
        situacao: 'concluida',
        icone: 'documento',
        proposta: c.proposta
      };
    } else {
      proposta = {
        titulo: 'Proposta de contratação',
        detalhe: encerrado ? 'Não enviada' : 'Pendente · Enviada pela empresa depois da entrevista',
        situacao: 'pendente',
        icone: 'documento'
      };
    }

    let resultado: EtapaProcesso;
    if (c.status === 'APROVADO') {
      resultado = {
        titulo: 'Contratação',
        detalhe: c.dataInicio
          ? `Contratação confirmada! · Início previsto em ${formatarDataSimples(c.dataInicio)}`
          : 'Contratação confirmada! · A empresa vai entrar em contato com os próximos passos',
        situacao: 'concluida',
        icone: 'medalha'
      };
    } else if (c.status === 'REPROVADO') {
      resultado = {
        titulo: 'Resposta final',
        detalhe: `Processo encerrado${quando('REPROVADO') ? ' · ' + quando('REPROVADO') : ''} · Não foi dessa vez, mas continue se candidatando!`,
        situacao: 'encerrada',
        icone: 'medalha',
        mensagem: c.mensagemEmpresa
      };
    } else if (c.status === 'DESISTIU') {
      resultado = {
        titulo: 'Resposta final',
        detalhe: 'Você recusou a proposta · Processo encerrado',
        situacao: 'encerrada',
        icone: 'medalha'
      };
    } else {
      resultado = {
        titulo: 'Contratação',
        detalhe: 'Pendente · Acontece quando você aceita a proposta',
        situacao: 'pendente',
        icone: 'medalha'
      };
    }

    return [recebida, analise, entrevista, proposta, resultado];
  });

  constructor() {
    this.carregar();
  }

  private idPcd(): number {
    const sessao = this.authService.sessao();
    // A rota é protegida pelo ambienteGuard('usuario'), então a sessão sempre existe aqui.
    return sessao?.ambiente === 'usuario' ? sessao.perfil.id : 0;
  }

  private carregar(): void {
    this.vagaService.obterMinhaCandidatura(this.idPcd(), this.idVaga).subscribe({
      next: (candidatura) => {
        this.candidatura.set(candidatura);
        this.carregando.set(false);
      },
      error: () => {
        this.erro.set('Não encontramos uma candidatura sua para esta vaga.');
        this.carregando.set(false);
      }
    });
  }

  protected responder(aceitar: boolean): void {
    this.respondendo.set(true);
    this.erroResposta.set(null);

    this.vagaService.responderProposta(this.idPcd(), this.idVaga, aceitar, this.motivoRecusa().trim()).subscribe({
      next: (candidatura) => {
        this.respondendo.set(false);
        this.recusando.set(false);
        this.candidatura.set(candidatura);
        this.toastService.sucesso(aceitar ? 'Parabéns! Contratação confirmada.' : 'Resposta enviada à empresa.');
      },
      error: (erro: HttpErrorResponse) => {
        this.respondendo.set(false);
        this.erroResposta.set(erro.error?.mensagem ?? 'Não foi possível enviar sua resposta. Tente novamente.');
      }
    });
  }

  protected aoDigitarMotivo(evento: Event): void {
    this.motivoRecusa.set((evento.target as HTMLTextAreaElement).value);
  }

  protected formatarFormato(entrevista: EntrevistaAgendada): string {
    return formatarFormatoEntrevista(entrevista.formato);
  }

  protected formatarSalario(valor: number): string {
    return formatarSalario(valor);
  }

  protected formatarDataSimples(data: string): string {
    return formatarDataSimples(data);
  }

  /** Link de chamada vira um link clicável; endereço fica como texto. */
  protected ehLink(local: string): boolean {
    return /^https?:\/\//i.test(local);
  }
}
