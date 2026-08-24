import { afterNextRender, ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { formatarCep, formatarCnpj, formatarTelefone } from '../../../shared/utils/masks';
import {
  validadorCep,
  validadorCnpj,
  validadorTelefone
} from '../../../shared/validators/br-validators';

type CampoComMascara = 'cnpj' | 'telefone' | 'cep';

@Component({
  selector: 'app-company-register',
  imports: [ReactiveFormsModule],
  templateUrl: './company-register.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CompanyRegister {
  private readonly roteador = inject(Router);
  private readonly rota = inject(ActivatedRoute);

  protected readonly estados = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
    'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ];

  protected readonly formulario = new FormGroup({
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
      validators: [Validators.required, validadorCnpj()]
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email]
    }),
    telefone: new FormControl('', { nonNullable: true, validators: [validadorTelefone()] }),
    cep: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, validadorCep()]
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

  protected readonly senhaVisivel = signal(false);
  protected readonly enviando = signal(false);
  protected readonly erroFormulario = signal<string | null>(null);

  /**
   * Campos de sistema. Ficam vazios na renderização do servidor e só são
   * preenchidos no navegador — senão a data gerada no SSR divergiria da
   * gerada no cliente e quebraria a hidratação.
   */
  protected readonly dataCadastro = signal('—');
  protected readonly idEmpresa = signal('—');

  constructor() {
    // Vem preenchido quando a pessoa já digitou o CNPJ na tela de escolha de ambiente (/cadastro).
    const cnpjDaUrl = this.rota.snapshot.queryParamMap.get('cnpj');
    if (cnpjDaUrl) {
      this.formulario.controls.cnpj.setValue(formatarCnpj(cnpjDaUrl));
    }

    afterNextRender(() => {
      this.dataCadastro.set(
        new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date())
      );
      // Provisório: o ID definitivo é gerado pelo backend ao salvar.
      this.idEmpresa.set(`ID - ${Math.floor(1_000_000 + Math.random() * 9_000_000)}`);
    });
  }

  protected alternarVisibilidadeSenha(): void {
    this.senhaVisivel.update((visivel) => !visivel);
  }

  protected temErro(campo: keyof typeof this.formulario.controls): boolean {
    const controle = this.formulario.controls[campo];
    return controle.invalid && (controle.touched || controle.dirty);
  }

  /** Aplica a máscara enquanto o usuário digita, sem disparar validação em loop. */
  protected aplicarMascara(campo: CampoComMascara, evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const formatadores = {
      cnpj: formatarCnpj,
      telefone: formatarTelefone,
      cep: formatarCep
    };
    const mascarado = formatadores[campo](entrada.value);

    entrada.value = mascarado;
    this.formulario.controls[campo].setValue(mascarado, { emitEvent: false });
  }

  protected aoCancelar(): void {
    this.roteador.navigate(['/teste']);
  }

  protected aoEnviar(): void {  
    this.erroFormulario.set(null);

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.erroFormulario.set('Revise os campos destacados antes de continuar.');
      return;
    }

    this.enviando.set(true);

    // TODO: substituir pela chamada real do serviço de empresas.
    console.log('cadastro de empresa', this.formulario.getRawValue());

    this.enviando.set(false);
  }
}
