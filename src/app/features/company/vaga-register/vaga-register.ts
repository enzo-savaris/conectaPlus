import { ChangeDetectionStrategy, Component, WritableSignal, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { Router } from '@angular/router';

import { VagaService } from '../../../shared/services/vaga.service';
import { ModeloTrabalho, TipoContratacao } from '../../../shared/types/vaga';

/** Garante que o salário máximo, quando informado, não fique menor que o mínimo. */
function salarioValido(grupo: AbstractControl): ValidationErrors | null {
  const minimo = grupo.get('salarioMinimo')?.value;
  const maximo = grupo.get('salarioMaximo')?.value;

  if (minimo !== null && maximo !== null && Number(minimo) > Number(maximo)) {
    return { salarioInvalido: true };
  }

  return null;
}

@Component({
  selector: 'app-vaga-register',
  imports: [ReactiveFormsModule],
  templateUrl: './vaga-register.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VagaRegister {
  private readonly roteador = inject(Router);
  private readonly vagaService = inject(VagaService);

  protected readonly estados = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
    'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ];

  protected readonly tiposContratacao: { valor: TipoContratacao; rotulo: string }[] = [
    { valor: 'CLT', rotulo: 'CLT' },
    { valor: 'PJ', rotulo: 'PJ' },
    { valor: 'ESTAGIO', rotulo: 'Estágio' },
    { valor: 'TEMPORARIO', rotulo: 'Temporário' },
    { valor: 'FREELANCER', rotulo: 'Freelancer' }
  ];

  protected readonly modelosTrabalho: { valor: ModeloTrabalho; rotulo: string }[] = [
    { valor: 'PRESENCIAL', rotulo: 'Presencial' },
    { valor: 'HIBRIDO', rotulo: 'Híbrido' },
    { valor: 'REMOTO', rotulo: 'Remoto' }
  ];

  protected readonly formulario = new FormGroup(
    {
      titulo: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(3)]
      }),
      area: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      tipoContratacao: new FormControl<TipoContratacao>('CLT', { nonNullable: true }),
      cidade: new FormControl('', { nonNullable: true }),
      estado: new FormControl('', { nonNullable: true }),
      modeloTrabalho: new FormControl<ModeloTrabalho>('HIBRIDO', { nonNullable: true }),
      salarioMinimo: new FormControl<number | null>(null),
      salarioMaximo: new FormControl<number | null>(null),
      descricao: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(10)]
      })
    },
    { validators: [salarioValido] }
  );

  protected readonly responsabilidades = signal<string[]>([]);
  protected readonly requisitos = signal<string[]>([]);
  protected readonly acessibilidade = signal<string[]>([]);
  protected readonly beneficios = signal<string[]>([]);

  protected readonly enviando = signal(false);
  protected readonly erroFormulario = signal<string | null>(null);

  protected temErro(campo: keyof typeof this.formulario.controls): boolean {
    const controle = this.formulario.controls[campo];
    return controle.invalid && (controle.touched || controle.dirty);
  }

  protected temErroDeSalario(): boolean {
    const { salarioMinimo, salarioMaximo } = this.formulario.controls;
    return (
      this.formulario.hasError('salarioInvalido') &&
      (salarioMinimo.touched || salarioMinimo.dirty || salarioMaximo.touched || salarioMaximo.dirty)
    );
  }

  /** Adiciona o texto digitado à lista e limpa o campo, sem envolver o FormGroup. */
  protected adicionarItem(lista: WritableSignal<string[]>, entrada: HTMLInputElement): void {
    const valor = entrada.value.trim();
    if (!valor) {
      return;
    }

    lista.update((itens) => [...itens, valor]);
    entrada.value = '';
    entrada.focus();
  }

  protected removerItem(lista: WritableSignal<string[]>, indice: number): void {
    lista.update((itens) => itens.filter((_, i) => i !== indice));
  }

  protected aoCancelar(): void {
    this.roteador.navigate(['/vagas']);
  }

  protected aoEnviar(): void {
    this.erroFormulario.set(null);

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.erroFormulario.set('Revise os campos destacados antes de continuar.');
      return;
    }

    this.enviando.set(true);
    const valores = this.formulario.getRawValue();

    this.vagaService
      .cadastrar({
        titulo: valores.titulo,
        area: valores.area || null,
        descricao: valores.descricao,
        cidade: valores.cidade || null,
        estado: valores.estado || null,
        modeloTrabalho: valores.modeloTrabalho,
        tipoContratacao: valores.tipoContratacao,
        salarioMinimo: valores.salarioMinimo,
        salarioMaximo: valores.salarioMaximo,
        responsabilidades: this.responsabilidades(),
        requisitos: this.requisitos(),
        acessibilidade: this.acessibilidade(),
        beneficios: this.beneficios()
      })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.roteador.navigate(['/vagas']);
        },
        error: () => {
          this.enviando.set(false);
          this.erroFormulario.set('Não foi possível publicar a vaga. Tente novamente.');
        }
      });
  }
}
