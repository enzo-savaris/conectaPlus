import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AdminService } from '../../../shared/services/admin.service';
import { ToastService } from '../../../shared/services/toast.service';
import { AcaoEmpresaAdmin, EmpresaAdminDetalhada } from '../../../shared/types/admin';
import {
  CLASSE_STATUS_EMPRESA,
  ROTULO_STATUS_EMPRESA,
  formatarDataHoraCompleta,
  formatarEspera
} from '../../../shared/utils/admin-format';
import { formatarCep, formatarCnpj, formatarTelefone } from '../../../shared/utils/masks';

/** Itens que a equipe confere antes de aprovar (só um lembrete na tela, não é gravado). */
const CHECKLIST = [
  'O CNPJ está ativo na Receita Federal',
  'A razão social bate com a da Receita',
  'O endereço é compatível com o da Receita',
  'O e-mail e o telefone parecem ser da própria empresa'
];

interface ConfigAcao {
  acao: AcaoEmpresaAdmin;
  titulo: string;
  botao: string;
  exigeMotivo: boolean;
  ajuda: string;
}

const ACOES: Record<AcaoEmpresaAdmin, ConfigAcao> = {
  APROVAR: {
    acao: 'APROVAR',
    titulo: 'Aprovar cadastro',
    botao: 'Confirmar aprovação',
    exigeMotivo: false,
    ajuda: 'A empresa passa a entrar na plataforma e publicar vagas e cursos. Observação opcional, só para a equipe.'
  },
  RECUSAR: {
    acao: 'RECUSAR',
    titulo: 'Recusar cadastro',
    botao: 'Confirmar recusa',
    exigeMotivo: true,
    ajuda: 'A empresa não consegue entrar e vê este motivo na tela de login. Seja claro e diga o que ela pode corrigir.'
  },
  INATIVAR: {
    acao: 'INATIVAR',
    titulo: 'Inativar empresa',
    botao: 'Confirmar inativação',
    exigeMotivo: true,
    ajuda: 'A empresa continua entrando, mas só para ver o que já publicou: não cadastra nem edita vagas e cursos.'
  }
};

/**
 * Análise de um cadastro de empresa: todos os dados, atalho para consultar o
 * CNPJ na Receita, alerta de outras empresas com o mesmo contato, e as
 * decisões (aprovar, recusar, inativar/reativar) com o histórico de quem
 * decidiu o quê.
 */
@Component({
  selector: 'app-admin-empresa-detalhe',
  imports: [RouterLink],
  templateUrl: './admin-empresa-detalhe.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminEmpresaDetalhe {
  private readonly adminService = inject(AdminService);
  private readonly toastService = inject(ToastService);

  protected readonly rotulo = ROTULO_STATUS_EMPRESA;
  protected readonly classeStatus = CLASSE_STATUS_EMPRESA;
  protected readonly checklist = CHECKLIST;

  private readonly idEmpresa = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));

  protected readonly empresa = signal<EmpresaAdminDetalhada | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);

  protected readonly acaoAberta = signal<ConfigAcao | null>(null);
  protected readonly motivo = signal('');
  protected readonly salvando = signal(false);
  protected readonly erroAcao = signal<string | null>(null);

  /** Ações possíveis no status atual — as mesmas regras do backend. */
  protected readonly acoesDisponiveis = computed<ConfigAcao[]>(() => {
    switch (this.empresa()?.status) {
      case 'PENDENTE':
        return [ACOES.APROVAR, ACOES.RECUSAR];
      case 'ATIVA':
        return [ACOES.INATIVAR];
      case 'INATIVA':
        return [{ ...ACOES.APROVAR, titulo: 'Reativar empresa', botao: 'Confirmar reativação' }];
      case 'RECUSADA':
        return [{ ...ACOES.APROVAR, titulo: 'Rever e aprovar', botao: 'Confirmar aprovação' }];
      default:
        return [];
    }
  });

  /** Link para a consulta pública de CNPJ da Receita Federal. */
  protected readonly linkReceita = 'https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/Cnpjreva_Solicitacao.aspx';

  constructor() {
    this.adminService.obterEmpresa(this.idEmpresa).subscribe({
      next: (empresa) => {
        this.empresa.set(empresa);
        this.carregando.set(false);
      },
      error: () => {
        this.erro.set('Não foi possível carregar essa empresa.');
        this.carregando.set(false);
      }
    });
  }

  protected abrirAcao(config: ConfigAcao): void {
    this.acaoAberta.set(config);
    this.motivo.set('');
    this.erroAcao.set(null);
  }

  protected cancelarAcao(): void {
    this.acaoAberta.set(null);
  }

  protected aoDigitarMotivo(evento: Event): void {
    this.motivo.set((evento.target as HTMLTextAreaElement).value);
  }

  protected confirmar(): void {
    const config = this.acaoAberta();
    if (!config) {
      return;
    }

    if (config.exigeMotivo && this.motivo().trim().length < 5) {
      this.erroAcao.set('Explique o motivo (a empresa vai ler esse texto).');
      return;
    }

    this.salvando.set(true);
    this.erroAcao.set(null);

    this.adminService.decidir(this.idEmpresa, config.acao, this.motivo().trim()).subscribe({
      next: (empresa) => {
        this.salvando.set(false);
        this.empresa.set(empresa);
        this.acaoAberta.set(null);
        this.toastService.sucesso(`Empresa ${this.rotulo[empresa.status].toLowerCase()} com sucesso.`);
      },
      error: (erro: HttpErrorResponse) => {
        this.salvando.set(false);
        this.erroAcao.set(erro.error?.mensagem ?? 'Não foi possível registrar a decisão. Tente novamente.');
      }
    });
  }

  protected copiar(texto: string): void {
    navigator.clipboard?.writeText(texto).then(
      () => this.toastService.sucesso('Copiado!'),
      () => undefined
    );
  }

  protected formatarCnpj(cnpj: string): string {
    return formatarCnpj(cnpj);
  }

  protected formatarTelefone(telefone: string): string {
    return formatarTelefone(telefone);
  }

  protected formatarCep(cep: string): string {
    return formatarCep(cep);
  }

  protected formatarData(data: string): string {
    return formatarDataHoraCompleta(data);
  }

  protected formatarEspera(data: string): string {
    return formatarEspera(data);
  }
}
