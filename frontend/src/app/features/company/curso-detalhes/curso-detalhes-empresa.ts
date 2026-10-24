import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthService } from '../../../shared/services/auth.service';
import { CursoService } from '../../../shared/services/curso.service';
import { CapituloCurso, CursoDetalhado, InscritoCurso } from '../../../shared/types/curso';
import { formatarCargaHorariaCurso, formatarPrecoCurso } from '../../../shared/utils/curso-format';

/** Tela de detalhes do curso para a empresa: dados, status e estrutura de módulos/aulas, com atalho de edição. */
@Component({
  selector: 'app-curso-detalhes-empresa',
  imports: [RouterLink],
  templateUrl: './curso-detalhes-empresa.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CursoDetalhesEmpresa {
  private readonly rota = inject(ActivatedRoute);
  private readonly cursoService = inject(CursoService);
  private readonly authService = inject(AuthService);

  protected readonly curso = signal<CursoDetalhado | null>(null);
  protected readonly inscritos = signal<InscritoCurso[]>([]);
  protected readonly erroInscritos = signal<string | null>(null);

  /** Resumo do topo da lista: quantos inscritos, pagos/ativos e concluídos. */
  protected readonly resumoInscritos = computed(() => {
    const lista = this.inscritos();
    return {
      total: lista.length,
      ativos: lista.filter((i) => i.statusMatricula === 'ATIVA').length,
      aguardando: lista.filter((i) => i.statusMatricula === 'PENDENTE').length,
      concluidos: lista.filter((i) => i.dataConclusao).length
    };
  });
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);
  private readonly modulosAbertos = signal<ReadonlySet<number>>(new Set());

  /** Só empresa ATIVA edita; PENDENTE/INATIVA apenas visualiza. */
  protected readonly empresaAtiva = computed(() => {
    const sessao = this.authService.sessao();
    return sessao?.ambiente !== 'empresa' || sessao.perfil.status === 'ATIVA';
  });

  protected readonly totalAulas = computed(
    () => this.curso()?.modulos.reduce((total, modulo) => total + modulo.capitulos.length, 0) ?? 0
  );

  constructor() {
    this.carregar(Number(this.rota.snapshot.paramMap.get('id')));
  }

  /** Garantido pelo ambienteGuard('empresa'): só entra aqui quem está logado como empresa. */
  private idEmpresaLogada(): number {
    const sessao = this.authService.sessao();
    return sessao?.ambiente === 'empresa' ? sessao.perfil.id : 0;
  }

  private carregar(idCurso: number): void {
    this.carregando.set(true);
    this.erro.set(null);

    this.cursoService.obterPorId(idCurso, { idEmpresa: this.idEmpresaLogada() }).subscribe({
      next: (curso) => {
        this.curso.set(curso);
        this.carregando.set(false);
        this.carregarInscritos(curso.id);

        const primeiroModulo = curso.modulos[0];
        if (primeiroModulo) {
          this.modulosAbertos.set(new Set([primeiroModulo.id]));
        }
      },
      error: () => {
        this.erro.set('Não foi possível carregar esse curso. Ele pode ter sido removido.');
        this.carregando.set(false);
      }
    });
  }

  private carregarInscritos(idCurso: number): void {
    this.cursoService.listarInscritos(idCurso, this.idEmpresaLogada()).subscribe({
      next: (inscritos) => this.inscritos.set(inscritos),
      error: () => this.erroInscritos.set('Não foi possível carregar os inscritos.')
    });
  }

  protected rotuloMatricula(inscrito: InscritoCurso): string {
    if (inscrito.dataConclusao) return 'Concluiu';
    switch (inscrito.statusMatricula) {
      case 'ATIVA':
        return 'Cursando';
      case 'PENDENTE':
        return 'Aguardando pagamento';
      default:
        return 'Cancelada';
    }
  }

  protected classeMatricula(inscrito: InscritoCurso): string {
    if (inscrito.dataConclusao) return 'border-emerald-400/40 bg-emerald-400/15 text-emerald-200';
    switch (inscrito.statusMatricula) {
      case 'ATIVA':
        return 'border-brand-400/40 bg-brand-400/10 text-brand-200';
      case 'PENDENTE':
        return 'border-amber-400/40 bg-amber-400/10 text-amber-200';
      default:
        return 'border-rose-400/40 bg-rose-400/10 text-rose-200';
    }
  }

  protected rotuloPagamento(inscrito: InscritoCurso): string {
    const pagamento = inscrito.pagamento;
    if (!pagamento) {
      return inscrito.valor > 0 ? 'Nenhuma tentativa de pagamento' : 'Gratuito';
    }

    const metodo = pagamento.metodo === 'PIX' ? 'Pix' : `Cartão${pagamento.parcelas > 1 ? ` em ${pagamento.parcelas}x` : ''}`;
    const status: Record<string, string> = {
      APROVADO: 'aprovado',
      PENDENTE: 'aguardando',
      RECUSADO: 'recusado',
      CANCELADO: 'cancelado/expirado',
      ESTORNADO: 'estornado'
    };
    return `${metodo} · ${status[pagamento.status] ?? pagamento.status}`;
  }

  protected classePagamento(inscrito: InscritoCurso): string {
    switch (inscrito.pagamento?.status) {
      case 'APROVADO':
        return 'text-emerald-300';
      case 'PENDENTE':
        return 'text-amber-300';
      case 'RECUSADO':
      case 'ESTORNADO':
        return 'text-rose-300';
      default:
        return 'text-slate-400';
    }
  }

  protected formatarDataInscricao(data: string): string {
    return new Date(data).toLocaleDateString('pt-BR');
  }

  protected moduloAberto(idModulo: number): boolean {
    return this.modulosAbertos().has(idModulo);
  }

  protected alternarModulo(idModulo: number): void {
    this.modulosAbertos.update((atual) => {
      const novo = new Set(atual);
      if (!novo.delete(idModulo)) {
        novo.add(idModulo);
      }
      return novo;
    });
  }

  protected linkDoCapitulo(capitulo: CapituloCurso): string | null {
    return capitulo.tipoConteudo === 'LINK' ? capitulo.linkCapitulo : capitulo.arquivoCapituloUrl;
  }

  protected formatarCargaHoraria(curso: CursoDetalhado): string {
    return formatarCargaHorariaCurso(curso.cargaHoraria);
  }

  protected formatarPreco(curso: CursoDetalhado): string {
    return formatarPrecoCurso(curso.preco);
  }

  protected formatarData(curso: CursoDetalhado): string {
    return new Date(curso.dataCadastro).toLocaleDateString('pt-BR');
  }
}
