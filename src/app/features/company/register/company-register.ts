import { afterNextRender, ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { formatCep, formatCnpj, formatPhone } from '../../../shared/utils/masks';
import { cepValidator, cnpjValidator, phoneValidator } from '../../../shared/validators/br-validators';

type MaskedField = 'cnpj' | 'phone' | 'cep';

@Component({
  selector: 'app-company-register',
  imports: [ReactiveFormsModule],
  templateUrl: './company-register.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CompanyRegister {
  private readonly router = inject(Router);

  protected readonly states = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
    'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ];

  protected readonly form = new FormGroup({
    // Dados da empresa
    razaoSocial: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3)]
    }),
    nomeFantasia: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2)]
    }),
    cnpj: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, cnpjValidator()]
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email]
    }),
    phone: new FormControl('', { nonNullable: true, validators: [phoneValidator()] }),
    cep: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, cepValidator()]
    }),

    // Endereço
    numero: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    complemento: new FormControl('', { nonNullable: true }),
    bairro: new FormControl('', { nonNullable: true }),
    cidade: new FormControl('', { nonNullable: true }),
    estado: new FormControl('', { nonNullable: true }),

    // Configuração de acesso
    senha: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8)]
    }),
    status: new FormControl<'ativo' | 'inativo'>('ativo', { nonNullable: true })
  });

  protected readonly showPassword = signal(false);
  protected readonly submitting = signal(false);
  protected readonly formError = signal<string | null>(null);

  /**
   * Campos de sistema. Ficam vazios na renderização do servidor e só são
   * preenchidos no navegador — senão a data gerada no SSR divergiria da
   * gerada no cliente e quebraria a hidratação.
   */
  protected readonly registeredAt = signal('—');
  protected readonly companyId = signal('—');

  constructor() {
    afterNextRender(() => {
      this.registeredAt.set(
        new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date())
      );
      // Provisório: o ID definitivo é gerado pelo backend ao salvar.
      this.companyId.set(`ID - ${Math.floor(1_000_000 + Math.random() * 9_000_000)}`);
    });
  }

  protected togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  protected hasError(field: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || control.dirty);
  }

  /** Aplica a máscara enquanto o usuário digita, sem disparar validação em loop. */
  protected applyMask(field: MaskedField, event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatters = { cnpj: formatCnpj, phone: formatPhone, cep: formatCep };
    const masked = formatters[field](input.value);

    input.value = masked;
    this.form.controls[field].setValue(masked, { emitEvent: false });
  }

  protected onCancel(): void {
    this.router.navigate(['/login']);
  }

  protected onSubmit(): void {
    this.formError.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.formError.set('Revise os campos destacados antes de continuar.');
      return;
    }

    this.submitting.set(true);

    // TODO: substituir pela chamada real do CompanyService.
    console.log('cadastro de empresa', this.form.getRawValue());

    this.submitting.set(false);
  }
}
