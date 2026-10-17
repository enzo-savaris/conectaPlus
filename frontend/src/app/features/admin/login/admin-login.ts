import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { Logo } from '../../../shared/components/logo/logo';
import { AuthService } from '../../../shared/services/auth.service';

/** Login da equipe Conecta+ (e-mail e senha), separado do login de candidatos e empresas. */
@Component({
  selector: 'app-admin-login',
  imports: [ReactiveFormsModule, Logo],
  templateUrl: './admin-login.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminLogin {
  private readonly authService = inject(AuthService);
  private readonly roteador = inject(Router);

  /** Veio para cá porque a sessão anterior expirou (o interceptor marca ?expirou=1). */
  protected readonly sessaoExpirou = inject(ActivatedRoute).snapshot.queryParamMap.has('expirou');

  protected readonly formulario = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    senha: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    lembrarDeMim: new FormControl(false, { nonNullable: true })
  });

  protected readonly enviando = signal(false);
  protected readonly erro = signal<string | null>(null);

  protected temErro(campo: 'email' | 'senha'): boolean {
    const controle = this.formulario.controls[campo];
    return controle.invalid && (controle.touched || controle.dirty);
  }

  protected aoEnviar(): void {
    this.erro.set(null);

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.erro.set('Informe e-mail e senha.');
      return;
    }

    this.enviando.set(true);
    const { email, senha, lembrarDeMim } = this.formulario.getRawValue();

    this.authService.entrarAdmin(email.trim(), senha, lembrarDeMim).subscribe({
      next: () => {
        this.enviando.set(false);
        this.roteador.navigate(['/admin/empresas']);
      },
      error: (erro: HttpErrorResponse) => {
        this.enviando.set(false);
        this.erro.set(erro.status === 401 ? 'E-mail ou senha incorretos.' : 'Não foi possível entrar agora. Tente novamente.');
      }
    });
  }
}
