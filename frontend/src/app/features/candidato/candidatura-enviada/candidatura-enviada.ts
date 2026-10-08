import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { EMAIL_SUPORTE } from '../../../shared/config/suporte';
import { AuthService } from '../../../shared/services/auth.service';
import { VagaService } from '../../../shared/services/vaga.service';
import {
  AcompanhamentoCandidatura,
  AdaptacoesCandidatura,
  EntrevistaAgendada,
  StatusCandidatura
} from '../../../shared/types/vaga';
import {
  formatarDataEntrevista,
  formatarDataHora,
  formatarDataSimples,
  formatarFormatoEntrevista
} from '../../../shared/utils/candidatura-format';

type SituacaoEtapa = 'concluida' | 'atual' | 'pendente' | 'encerrada';

interface EtapaProcesso {
  titulo: string;
  detalhe: string;
  situacao: SituacaoEtapa;
  icone: 'check' | 'olho' | 'conversa' | 'medalha';
  /** Só na etapa de entrevista, quando a empresa já agendou. */
  entrevista?: EntrevistaAgendada;
  /** Só na etapa final: a mensagem da empresa (contratação ou retorno). */
  mensagem?: string | null;
}

/** Texto do selo "Estágio atual" no topo da tela. */
const ESTAGIO_ATUAL: Record<StatusCandidatura, string> = {
  PENDENTE: 'Candidatura recebida',
  EM_ANALISE: 'Análise de currículo',
  ENTREVISTA: 'Entrevista agendada',
  APROVADO: 'Contratação confirmada',
  REPROVADO: 'Processo encerrado'
};

/**
 * Confirmação depois do envio da candidatura, que também serve de tela de
 * acompanhamento: a linha do tempo de "Próximos passos" é montada a partir do
 * status que a empresa vai atualizando na tela "Gerenciar candidatura", então
 * reabrir essa página mostra em que estágio o processo está — com a data de
 * cada passo, os dados da entrevista e a resposta final.
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

  protected readonly linkSuporte = `mailto:${EMAIL_SUPORTE}`;

  protected readonly candidatura = signal<AcompanhamentoCandidatura | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);

  protected readonly opcoesAdaptacao: { chave: keyof AdaptacoesCandidatura; rotulo: string }[] = [
    { chave: 'entrevistaRemota', rotulo: 'Entrevista 100% remota' },
    { chave: 'tempoEstendido', rotulo: 'Tempo estendido em testes' },
    { chave: 'interpreteLibras', rotulo: 'Intérprete de Libras' }
  ];

  protected readonly estagioAtual = computed(() => {
    const candidatura = this.candidatura();
    return candidatura ? ESTAGIO_ATUAL[candidatura.status] : '';
  });

  protected readonly etapas = computed<EtapaProcesso[]>(() => {
    const c = this.candidatura();
    if (!c) {
      return [];
    }

    /** Quando a candidatura entrou na etapa, segundo o histórico. */
    const quando = (status: StatusCandidatura): string | null => {
      const data = [...c.historico].reverse().find((item) => item.status === status)?.data;
      return data ? formatarDataHora(data) : null;
    };

    const final = c.status === 'APROVADO' || c.status === 'REPROVADO';
    const teveEntrevista = c.entrevista !== null && (c.status === 'ENTREVISTA' || final);

    const recebida: EtapaProcesso = {
      titulo: 'Candidatura recebida',
      detalhe: `${formatarDataHora(c.dataCandidatura)} · Enviado com sucesso`,
      situacao: 'concluida',
      icone: 'check'
    };

    const analise: EtapaProcesso =
      c.status === 'PENDENTE'
        ? {
            titulo: 'Análise de currículo',
            detalhe: 'Aguardando a empresa · Retorno estimado em até 3 dias úteis',
            situacao: 'atual',
            icone: 'olho'
          }
        : c.status === 'EM_ANALISE'
          ? {
              titulo: 'Análise de currículo',
              detalhe: `Em andamento${quando('EM_ANALISE') ? ' desde ' + quando('EM_ANALISE')!.toLowerCase() : ''} · Retorno estimado em até 3 dias úteis`,
              situacao: 'atual',
              icone: 'olho'
            }
          : {
              titulo: 'Análise de currículo',
              detalhe: `Concluída${quando('EM_ANALISE') ? ' · Iniciada ' + quando('EM_ANALISE')!.toLowerCase() : ''}`,
              situacao: 'concluida',
              icone: 'olho'
            };

    let entrevista: EtapaProcesso;
    if (c.status === 'ENTREVISTA' && c.entrevista) {
      entrevista = {
        titulo: 'Entrevista acessível',
        detalhe: `Agendada · ${formatarDataEntrevista(c.entrevista.data)}`,
        situacao: 'atual',
        icone: 'conversa',
        entrevista: c.entrevista
      };
    } else if (final && teveEntrevista && c.entrevista) {
      entrevista = {
        titulo: 'Entrevista acessível',
        detalhe: `Realizada · ${formatarDataEntrevista(c.entrevista.data)}`,
        situacao: 'concluida',
        icone: 'conversa'
      };
    } else if (final) {
      entrevista = {
        titulo: 'Entrevista acessível',
        detalhe: c.status === 'APROVADO' ? 'Não foi necessária' : 'Não realizada',
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

    let resultado: EtapaProcesso;
    if (c.status === 'APROVADO') {
      resultado = {
        titulo: 'Resposta final',
        detalhe: c.dataInicio
          ? `Contratação confirmada! · Início previsto em ${formatarDataSimples(c.dataInicio)}`
          : 'Contratação confirmada! · A empresa vai entrar em contato com os próximos passos',
        situacao: 'concluida',
        icone: 'medalha',
        mensagem: c.mensagemEmpresa
      };
    } else if (c.status === 'REPROVADO') {
      resultado = {
        titulo: 'Resposta final',
        detalhe: `Processo encerrado${quando('REPROVADO') ? ' · ' + quando('REPROVADO') : ''} · Não foi dessa vez, mas continue se candidatando!`,
        situacao: 'encerrada',
        icone: 'medalha',
        mensagem: c.mensagemEmpresa
      };
    } else {
      resultado = {
        titulo: 'Resposta final',
        detalhe: 'Pendente · Até 7 dias úteis após a entrevista',
        situacao: 'pendente',
        icone: 'medalha'
      };
    }

    return [recebida, analise, entrevista, resultado];
  });

  constructor() {
    const idVaga = Number(this.rota.snapshot.paramMap.get('id'));
    const sessao = this.authService.sessao();
    // A rota é protegida pelo ambienteGuard('usuario'), então a sessão sempre existe aqui.
    const idPcd = sessao?.ambiente === 'usuario' ? sessao.perfil.id : 0;

    this.vagaService.obterMinhaCandidatura(idPcd, idVaga).subscribe({
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

  protected formatarFormato(entrevista: EntrevistaAgendada): string {
    return formatarFormatoEntrevista(entrevista.formato);
  }

  /** Link de chamada vira um link clicável; endereço fica como texto. */
  protected ehLink(local: string): boolean {
    return /^https?:\/\//i.test(local);
  }
}
