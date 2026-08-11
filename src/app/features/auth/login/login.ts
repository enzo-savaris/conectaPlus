import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

type ProvedorSocial = 'google' | 'apple';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Login {
  protected readonly formulario = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email]
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

  protected temErro(campo: 'email' | 'senha'): boolean {
    const controle = this.formulario.controls[campo];
    return controle.invalid && (controle.touched || controle.dirty);
  }

  protected aoEnviar(): void {
    this.erroFormulario.set(null);

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.erroFormulario.set('Verifique os campos destacados para continuar.');
      return;
    }

    this.enviando.set(true);
    const { email, senha, lembrarDeMim } = this.formulario.getRawValue();

    // TODO: substituir pela chamada real do serviço de autenticação.
    console.log('login', { email, senha, lembrarDeMim });

    this.enviando.set(false);
  }
}
