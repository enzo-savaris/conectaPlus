import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { BrandPanel } from '../../../layout/brand-panel/brand-panel';
import { formatarCpfOuCnpj } from '../../../shared/utils/masks';
import { validadorCpfOuCnpj } from '../../../shared/validators/br-validators';
import { Ambiente } from '../../../shared/types/ambiente';

/** Tela de escolha de ambiente ao criar uma conta: candidato PCD ou empresa. */
@Component({
  selector: 'app-register-choice',
  imports: [ReactiveFormsModule, RouterLink, BrandPanel],
  templateUrl: './register-choice.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterChoice {
  private readonly roteador = inject(Router);

  protected readonly ambiente = signal<Ambiente | null>(null);
  protected readonly avisoPcd = signal(false);
  protected readonly erroFormulario = signal<string | null>(null);

  protected readonly formulario = new FormGroup({
    documento: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, validadorCpfOuCnpj()]
    })
  });

  protected escolherAmbiente(ambiente: Ambiente): void {
    this.ambiente.set(ambiente);
    this.avisoPcd.set(false);
    this.erroFormulario.set(null);
  }

  /** Aplica a máscara de CPF/CNPJ enquanto a pessoa digita. */
  protected aplicarMascara(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const mascarado = formatarCpfOuCnpj(entrada.value);

    entrada.value = mascarado;
    this.formulario.controls.documento.setValue(mascarado, { emitEvent: false });
  }

  protected temErro(): boolean {
    const controle = this.formulario.controls.documento;
    return controle.invalid && (controle.touched || controle.dirty);
  }

  protected aoContinuar(): void {
    this.erroFormulario.set(null);
    this.avisoPcd.set(false);

    const ambiente = this.ambiente();
    if (ambiente === null) {
      this.erroFormulario.set('Escolha um ambiente para continuar.');
      return;
    }

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.erroFormulario.set('Informe um CPF ou CNPJ válido para continuar.');
      return;
    }

    if (ambiente === 'usuario') {
      this.avisoPcd.set(true);
      return;
    }

    const documento = this.formulario.controls.documento.value;
    this.roteador.navigate(['/empresa/cadastro'], { queryParams: { cnpj: documento } });
  }
}
