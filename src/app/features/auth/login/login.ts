import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../shared/services/auth.service';
import { formatarCpfOuCnpj } from '../../../shared/utils/masks';
import { validadorCpfOuCnpj } from '../../../shared/validators/br-validators';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Login {
  private readonly authService = inject(AuthService);
  private readonly roteador = inject(Router);

  protected readonly formulario = new FormGroup({
    documento: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, validadorCpfOuCnpj()]
    }),
    senha: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(6)]
    }),
    lembrarDeMim: new FormControl(false, { nonNullable: true })
  });

  protected readonly senhaVisivel = signal(false);
  protected readonly enviando = signal(false);
  protected readonly erroFormulario = signal<string | null>(null);

  protected alternarVisibilidadeSenha(): void {
    this.senhaVisivel.update((visivel) => !visivel);
  }

  protected temErro(campo: 'documento' | 'senha'): boolean {
    const controle = this.formulario.controls[campo];
    return controle.invalid && (controle.touched || controle.dirty);
  }

  /** Aplica a máscara de CPF/CNPJ enquanto o usuário digita. */
  protected aplicarMascara(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const mascarado = formatarCpfOuCnpj(entrada.value);

    entrada.value = mascarado;
    this.formulario.controls.documento.setValue(mascarado, { emitEvent: false });
  }

  protected aoEnviar(): void {
    this.erroFormulario.set(null);

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.erroFormulario.set('Verifique os campos destacados para continuar.');
      return;
    }

    this.enviando.set(true);
    const { documento, senha, lembrarDeMim } = this.formulario.getRawValue();

    this.authService.entrar(documento, senha, lembrarDeMim).subscribe({
      next: (sessao) => {
        this.enviando.set(false);
        const destino = sessao.ambiente === 'empresa' ? '/empresa/candidatos' : '/painel';
        this.roteador.navigate([destino]);
      },
      error: (erro: { status?: number }) => {
        this.enviando.set(false);
        this.erroFormulario.set(
          erro.status === 401
            ? 'CPF/CNPJ ou senha incorretos.'
            : 'Não foi possível entrar agora. Tente novamente.'
        );
      }
    });
  }
}
