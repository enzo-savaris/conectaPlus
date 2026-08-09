import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

type SocialProvider = 'google' | 'apple';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Login {
  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email]
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(6)]
    }),
    remember: new FormControl(false, { nonNullable: true })
  });

  protected readonly showPassword = signal(false);
  protected readonly submitting = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  protected hasError(field: 'email' | 'password'): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || control.dirty);
  }

  protected onSubmit(): void {
    this.formError.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.formError.set('Verifique os campos destacados para continuar.');
      return;
    }

    this.submitting.set(true);
    const { email, password, remember } = this.form.getRawValue();

    // TODO: substituir pela chamada real do AuthService.
    console.log('login', { email, password, remember });

    this.submitting.set(false);
  }

  protected onSocialLogin(provider: SocialProvider): void {
    // TODO: substituir pela integração OAuth real.
    console.log('social login', provider);
  }
}
