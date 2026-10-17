import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { AdminService } from '../../../shared/services/admin.service';
import { AuthService } from '../../../shared/services/auth.service';
import { ToastService } from '../../../shared/services/toast.service';
import { MembroEquipe } from '../../../shared/types/admin';
import { formatarDataHoraCompleta } from '../../../shared/utils/admin-format';

/** Membros da equipe: quem pode validar empresas. Adicionar colegas e cortar acessos. */
@Component({
  selector: 'app-admin-equipe',
  imports: [ReactiveFormsModule],
  templateUrl: './admin-equipe.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminEquipe {
  private readonly adminService = inject(AdminService);
  private readonly toastService = inject(ToastService);
  private readonly authService = inject(AuthService);

  protected readonly membros = signal<MembroEquipe[]>([]);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);

  protected readonly formularioAberto = signal(false);
  protected readonly salvando = signal(false);
  protected readonly erroFormulario = signal<string | null>(null);

  protected readonly idLogado = computed(() => {
    const sessao = this.authService.sessao();
    return sessao?.ambiente === 'admin' ? sessao.perfil.id : 0;
  });

  protected readonly formulario = new FormGroup({
    nome: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3)] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    senha: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] })
  });

  constructor() {
    this.adminService.listarEquipe().subscribe({
      next: (membros) => {
        this.membros.set(membros);
        this.carregando.set(false);
      },
      error: () => {
        this.erro.set('Não foi possível carregar a equipe.');
        this.carregando.set(false);
      }
    });
  }

  protected abrirFormulario(): void {
    this.formulario.reset();
    this.erroFormulario.set(null);
    this.formularioAberto.set(true);
  }

  protected adicionar(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.erroFormulario.set('Preencha nome, e-mail válido e uma senha com ao menos 8 caracteres.');
      return;
    }

    this.salvando.set(true);
    this.erroFormulario.set(null);
    const { nome, email, senha } = this.formulario.getRawValue();

    this.adminService.criarMembro(nome.trim(), email.trim(), senha).subscribe({
      next: (membros) => {
        this.salvando.set(false);
        this.membros.set(membros);
        this.formularioAberto.set(false);
        this.toastService.sucesso(`${nome.trim()} foi adicionado(a) à equipe.`);
      },
      error: (erro: HttpErrorResponse) => {
        this.salvando.set(false);
        this.erroFormulario.set(erro.error?.mensagem ?? 'Não foi possível adicionar. Tente novamente.');
      }
    });
  }

  protected alternarAcesso(membro: MembroEquipe): void {
    this.adminService.alterarStatusMembro(membro.id, !membro.ativo).subscribe({
      next: (membros) => {
        this.membros.set(membros);
        this.toastService.sucesso(membro.ativo ? `Acesso de ${membro.nome} desativado.` : `Acesso de ${membro.nome} reativado.`);
      },
      error: (erro: HttpErrorResponse) =>
        this.toastService.erro(erro.error?.mensagem ?? 'Não foi possível alterar o acesso.')
    });
  }

  protected temErro(campo: 'nome' | 'email' | 'senha'): boolean {
    const controle = this.formulario.controls[campo];
    return controle.invalid && controle.touched;
  }

  protected formatarData(data: string): string {
    return formatarDataHoraCompleta(data);
  }
}
