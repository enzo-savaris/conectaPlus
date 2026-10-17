import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';

import { AdminService } from '../../../shared/services/admin.service';
import { EmpresaAdmin, StatusEmpresaAdmin } from '../../../shared/types/admin';
import {
  CLASSE_STATUS_EMPRESA,
  ROTULO_STATUS_EMPRESA,
  formatarDataHoraCompleta,
  formatarEspera
} from '../../../shared/utils/admin-format';
import { formatarCnpj } from '../../../shared/utils/masks';

const ABAS: StatusEmpresaAdmin[] = ['PENDENTE', 'ATIVA', 'INATIVA', 'RECUSADA'];

/**
 * Fila de validação das empresas. A aba "Pendentes" é a que importa no dia a
 * dia: mostra das mais antigas para as mais novas, para quem espera há mais
 * tempo ser analisado primeiro. A aba e a busca ficam na URL (?status=&busca=),
 * então o "Voltar" do detalhe cai exatamente onde a pessoa estava.
 */
@Component({
  selector: 'app-admin-empresas',
  imports: [RouterLink],
  templateUrl: './admin-empresas.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminEmpresas {
  private readonly adminService = inject(AdminService);
  private readonly rota = inject(ActivatedRoute);
  private readonly roteador = inject(Router);

  protected readonly abas = ABAS;
  protected readonly rotulo = ROTULO_STATUS_EMPRESA;
  protected readonly classeStatus = CLASSE_STATUS_EMPRESA;

  protected readonly status = signal<StatusEmpresaAdmin>('PENDENTE');
  protected readonly busca = signal('');
  protected readonly empresas = signal<EmpresaAdmin[]>([]);
  protected readonly contagem = signal<Record<StatusEmpresaAdmin, number>>({ PENDENTE: 0, ATIVA: 0, INATIVA: 0, RECUSADA: 0 });
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);

  private readonly digitacao = new Subject<string>();

  constructor() {
    this.rota.queryParamMap.subscribe((parametros) => {
      const status = (parametros.get('status') ?? 'PENDENTE').toUpperCase() as StatusEmpresaAdmin;
      this.status.set(ABAS.includes(status) ? status : 'PENDENTE');
      this.busca.set(parametros.get('busca') ?? '');
      this.carregar();
    });

    // Espera a pessoa parar de digitar antes de buscar.
    const assinatura = this.digitacao.pipe(debounceTime(350)).subscribe((termo) => this.atualizarUrl({ busca: termo || null }));
    inject(DestroyRef).onDestroy(() => assinatura.unsubscribe());
  }

  private carregar(): void {
    this.carregando.set(true);
    this.erro.set(null);

    this.adminService.listarEmpresas(this.status(), this.busca()).subscribe({
      next: ({ empresas, contagem }) => {
        this.empresas.set(empresas);
        this.contagem.set(contagem);
        this.carregando.set(false);
      },
      error: () => {
        this.erro.set('Não foi possível carregar as empresas.');
        this.carregando.set(false);
      }
    });
  }

  protected escolherAba(status: StatusEmpresaAdmin): void {
    this.atualizarUrl({ status });
  }

  protected aoDigitarBusca(evento: Event): void {
    this.digitacao.next((evento.target as HTMLInputElement).value.trim());
  }

  private atualizarUrl(parametros: Record<string, string | null>): void {
    this.roteador.navigate([], { relativeTo: this.rota, queryParams: parametros, queryParamsHandling: 'merge' });
  }

  protected formatarCnpj(cnpj: string): string {
    return formatarCnpj(cnpj);
  }

  protected formatarData(data: string): string {
    return formatarDataHoraCompleta(data);
  }

  protected formatarEspera(data: string): string {
    return formatarEspera(data);
  }
}
