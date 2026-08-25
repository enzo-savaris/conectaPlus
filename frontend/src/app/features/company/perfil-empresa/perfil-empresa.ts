import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';

import { AuthService } from '../../../shared/services/auth.service';
import { EmpresaService } from '../../../shared/services/empresa.service';
import { AtualizarEmpresa, Empresa } from '../../../shared/types/empresa';
import { formatarCep, formatarCnpj, formatarTelefone } from '../../../shared/utils/masks';
import { validadorCep, validadorCnpj, validadorTelefone } from '../../../shared/validators/br-validators';

type CampoComMascara = 'cnpj' | 'telefone' | 'cep';

/** Garante que as duas senhas digitadas conferem, quando alguma foi preenchida. */
function senhasConferem(grupo: AbstractControl): ValidationErrors | null {
  const novaSenha = grupo.get('novaSenha')?.value;
  const confirmarSenha = grupo.get('confirmarSenha')?.value;

  if (!novaSenha && !confirmarSenha) {
    return null;
  }

  return novaSenha === confirmarSenha ? null : { senhasDiferentes: true };
}

/** Tela de perfil da empresa: dados reais do banco, editáveis só no modo edição. */
@Component({
  selector: 'app-perfil-empresa',
  imports: [ReactiveFormsModule],
  templateUrl: './perfil-empresa.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PerfilEmpresa {
  private readonly empresaService = inject(EmpresaService);
  private readonly authService = inject(AuthService);

  protected readonly estados = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
    'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ];

  protected readonly empresa = signal<Empresa | null>(null);
  protected readonly modoEdicao = signal(false);
  protected readonly carregando = signal(true);
  protected readonly salvando = signal(false);
  protected readonly senhaVisivel = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly sucesso = signal<string | null>(null);

  protected readonly formulario = new FormGroup(
    {
      razaoSocial: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(3)]
      }),
      nomeFantasia: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(2)]
      }),
      cnpj: new FormControl('', { nonNullable: true, validators: [Validators.required, validadorCnpj()] }),
      email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
      telefone: new FormControl('', { nonNullable: true, validators: [validadorTelefone()] }),
      cep: new FormControl('', { nonNullable: true, validators: [validadorCep()] }),
      numero: new FormControl('', { nonNullable: true }),
      complemento: new FormControl('', { nonNullable: true }),
      bairro: new FormControl('', { nonNullable: true }),
      cidade: new FormControl('', { nonNullable: true }),
      estado: new FormControl('', { nonNullable: true }),
      novaSenha: new FormControl('', {
        nonNullable: true,
        validators: [Validators.minLength(8)]
      }),
      confirmarSenha: new FormControl('', { nonNullable: true })
    },
    { validators: [senhasConferem] }
  );

  protected readonly statusInfo = computed(() => {
    switch (this.empresa()?.status) {
      case 'ATIVA':
        return { rotulo: 'Empresa validada', classe: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300' };
      case 'PENDENTE':
        return { rotulo: 'Aguardando validação', classe: 'border-amber-400/40 bg-amber-400/10 text-amber-300' };
      default:
        return { rotulo: 'Empresa inativa', classe: 'border-rose-400/40 bg-rose-400/10 text-rose-300' };
    }
  });

  constructor() {
    this.formulario.disable();
    this.carregarEmpresa();
  }

  /** Garantido pelo ambienteGuard('empresa'): só entra aqui quem está logado como empresa. */
  private idEmpresaLogada(): number {
    const sessao = this.authService.sessao();
    return sessao?.ambiente === 'empresa' ? sessao.perfil.id : 0;
  }

  private carregarEmpresa(): void {
    this.carregando.set(true);
    this.erro.set(null);

    this.empresaService.obterPorId(this.idEmpresaLogada()).subscribe({
      next: (empresa) => {
        this.empresa.set(empresa);
        this.preencherFormulario(empresa);
        this.carregando.set(false);
      },
      error: () => {
        this.erro.set('Não foi possível carregar os dados da empresa.');
        this.carregando.set(false);
      }
    });
  }

  private preencherFormulario(empresa: Empresa): void {
    this.formulario.reset({
      razaoSocial: empresa.razaoSocial,
      nomeFantasia: empresa.nomeFantasia ?? '',
      cnpj: formatarCnpj(empresa.cnpj),
      email: empresa.email ?? '',
      telefone: empresa.telefone ? formatarTelefone(empresa.telefone) : '',
      cep: empresa.cep ? formatarCep(empresa.cep) : '',
      numero: empresa.numero ?? '',
      complemento: empresa.complemento ?? '',
      bairro: empresa.bairro ?? '',
      cidade: empresa.cidade ?? '',
      estado: empresa.estado ?? '',
      novaSenha: '',
      confirmarSenha: ''
    });
    this.formulario.disable();
  }

  protected temErro(campo: keyof typeof this.formulario.controls): boolean {
    const controle = this.formulario.controls[campo];
    return controle.invalid && (controle.touched || controle.dirty);
  }

  protected temErroDeSenha(): boolean {
    const { novaSenha, confirmarSenha } = this.formulario.controls;
    return (
      this.formulario.hasError('senhasDiferentes') &&
      (novaSenha.touched || novaSenha.dirty || confirmarSenha.touched || confirmarSenha.dirty)
    );
  }

  protected alternarVisibilidadeSenha(): void {
    this.senhaVisivel.update((visivel) => !visivel);
  }

  /** Aplica a máscara enquanto a pessoa digita, sem disparar validação em loop. */
  protected aplicarMascara(campo: CampoComMascara, evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const formatadores = { cnpj: formatarCnpj, telefone: formatarTelefone, cep: formatarCep };
    const mascarado = formatadores[campo](entrada.value);

    entrada.value = mascarado;
    this.formulario.controls[campo].setValue(mascarado, { emitEvent: false });
  }

  protected aoClicarEditar(): void {
    this.sucesso.set(null);
    this.erro.set(null);
    this.modoEdicao.set(true);
    this.formulario.enable();
  }

  protected aoCancelar(): void {
    const empresa = this.empresa();
    if (empresa) {
      this.preencherFormulario(empresa);
    }
    this.erro.set(null);
    this.modoEdicao.set(false);
  }

  protected aoSalvar(): void {
    this.erro.set(null);
    this.sucesso.set(null);

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.erro.set('Revise os campos destacados antes de salvar.');
      return;
    }

    this.salvando.set(true);
    const valores = this.formulario.getRawValue();

    const dados: AtualizarEmpresa = {
      razaoSocial: valores.razaoSocial,
      nomeFantasia: valores.nomeFantasia || null,
      cnpj: valores.cnpj,
      email: valores.email || null,
      telefone: valores.telefone || null,
      cep: valores.cep || null,
      numero: valores.numero || null,
      complemento: valores.complemento || null,
      bairro: valores.bairro || null,
      cidade: valores.cidade || null,
      estado: valores.estado || null
    };

    if (valores.novaSenha) {
      dados.senha = valores.novaSenha;
    }

    this.empresaService.atualizar(this.idEmpresaLogada(), dados).subscribe({
      next: (empresa) => {
        this.empresa.set(empresa);
        this.preencherFormulario(empresa);
        this.modoEdicao.set(false);
        this.salvando.set(false);
        this.sucesso.set('Perfil atualizado com sucesso.');
      },
      error: () => {
        this.salvando.set(false);
        this.erro.set('Não foi possível salvar as alterações. Tente novamente.');
      }
    });
  }

  protected formatarData(data: string | null): string {
    if (!data) {
      return '—';
    }

    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(data));
  }
}
