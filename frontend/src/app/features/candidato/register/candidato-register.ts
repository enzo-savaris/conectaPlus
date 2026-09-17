import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { UsuarioService } from '../../../shared/services/usuario.service';
import { NovoCandidato, TipoDeficiencia } from '../../../shared/types/candidato';
import { formatarCpf, formatarTelefone } from '../../../shared/utils/masks';
import { validadorCpf, validadorTelefone } from '../../../shared/validators/br-validators';

type CampoComMascara = 'cpf' | 'telefone';

const TIPOS_DEFICIENCIA: { valor: TipoDeficiencia; rotulo: string }[] = [
  { valor: 'FISICA', rotulo: 'Física' },
  { valor: 'AUDITIVA', rotulo: 'Auditiva' },
  { valor: 'VISUAL', rotulo: 'Visual' },
  { valor: 'INTELECTUAL', rotulo: 'Intelectual' }
];

const RECURSOS_DISPONIVEIS = [
  'Libras',
  'Leitor de telas',
  'Legenda',
  'Rampa de acesso',
  'Banheiros acessíveis',
  'Alto contraste',
  'Linguagem simples',
  'Comandos de voz',
  'Tradutores',
  'Outros'
];

/** Cadastro do candidato PCD em duas etapas: dados da conta, depois acessibilidade e interesses. */
@Component({
  selector: 'app-candidato-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './candidato-register.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CandidatoRegister {
  private readonly roteador = inject(Router);
  private readonly rota = inject(ActivatedRoute);
  private readonly usuarioService = inject(UsuarioService);

  protected readonly tiposDeficiencia = TIPOS_DEFICIENCIA;
  protected readonly recursosDisponiveis = RECURSOS_DISPONIVEIS;

  /** Etapa 1: dados da conta. Etapa 2: acessibilidade e áreas de interesse. */
  protected readonly etapa = signal<1 | 2>(1);
  protected readonly enviando = signal(false);
  protected readonly erroFormulario = signal<string | null>(null);

  protected readonly avatarSelecionado = signal<File | null>(null);
  protected readonly avatarPreviewUrl = signal<string | null>(null);

  protected readonly tipoDeficienciaSelecionado = signal<TipoDeficiencia | null>(null);
  protected readonly recursosSelecionados = signal<ReadonlySet<string>>(new Set());
  protected readonly interesses = signal<string[]>([]);

  protected readonly formularioConta = new FormGroup({
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3)]
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email]
    }),
    telefone: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, validadorTelefone()]
    }),
    cpf: new FormControl('', { nonNullable: true, validators: [Validators.required, validadorCpf()] }),
    senha: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8)]
    }),
    aceitaTermos: new FormControl(false, { nonNullable: true, validators: [Validators.requiredTrue] })
  });

  protected readonly senhaVisivel = signal(false);

  constructor() {
    // Vem preenchido quando a pessoa já digitou o CPF na tela de escolha de ambiente (/cadastro).
    const cpfDaUrl = this.rota.snapshot.queryParamMap.get('cpf');
    if (cpfDaUrl) {
      this.formularioConta.controls.cpf.setValue(formatarCpf(cpfDaUrl));
    }
  }

  protected alternarVisibilidadeSenha(): void {
    this.senhaVisivel.update((visivel) => !visivel);
  }

  protected temErroConta(campo: keyof typeof this.formularioConta.controls): boolean {
    const controle = this.formularioConta.controls[campo];
    return controle.invalid && (controle.touched || controle.dirty);
  }

  /** Aplica a máscara enquanto a pessoa digita, sem disparar validação em loop. */
  protected aplicarMascara(campo: CampoComMascara, evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const formatadores = { cpf: formatarCpf, telefone: formatarTelefone };
    const mascarado = formatadores[campo](entrada.value);

    entrada.value = mascarado;
    this.formularioConta.controls[campo].setValue(mascarado, { emitEvent: false });
  }

  protected selecionarAvatar(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const arquivo = entrada.files?.[0] ?? null;
    this.avatarSelecionado.set(arquivo);

    const urlAnterior = this.avatarPreviewUrl();
    if (urlAnterior) {
      URL.revokeObjectURL(urlAnterior);
    }
    this.avatarPreviewUrl.set(arquivo ? URL.createObjectURL(arquivo) : null);
  }

  protected aoAvancar(): void {
    this.erroFormulario.set(null);

    if (this.formularioConta.invalid) {
      this.formularioConta.markAllAsTouched();
      this.erroFormulario.set('Revise os campos destacados antes de continuar.');
      return;
    }

    this.etapa.set(2);
  }

  protected aoVoltar(): void {
    this.erroFormulario.set(null);
    this.etapa.set(1);
  }

  protected selecionarTipoDeficiencia(tipo: TipoDeficiencia): void {
    this.tipoDeficienciaSelecionado.set(tipo);
  }

  protected alternarRecurso(recurso: string): void {
    this.recursosSelecionados.update((atual) => {
      const novo = new Set(atual);
      if (novo.has(recurso)) {
        novo.delete(recurso);
      } else {
        novo.add(recurso);
      }
      return novo;
    });
  }

  protected recursoSelecionado(recurso: string): boolean {
    return this.recursosSelecionados().has(recurso);
  }

  /** Adiciona o texto digitado à lista de interesses e limpa o campo. */
  protected adicionarInteresse(entrada: HTMLInputElement): void {
    const valor = entrada.value.trim();
    if (!valor) {
      return;
    }

    this.interesses.update((lista) => (lista.includes(valor) ? lista : [...lista, valor]));
    entrada.value = '';
    entrada.focus();
  }

  protected removerInteresse(indice: number): void {
    this.interesses.update((lista) => lista.filter((_, i) => i !== indice));
  }

  protected aoFinalizar(): void {
    this.erroFormulario.set(null);

    if (this.tipoDeficienciaSelecionado() === null) {
      this.erroFormulario.set('Selecione o tipo de deficiência para continuar.');
      return;
    }

    this.enviando.set(true);
    const valoresConta = this.formularioConta.getRawValue();

    const dados: NovoCandidato = {
      nome: valoresConta.nome,
      email: valoresConta.email,
      telefone: valoresConta.telefone,
      cpf: valoresConta.cpf,
      senha: valoresConta.senha,
      tipoDeficiencia: this.tipoDeficienciaSelecionado()!,
      recursos: Array.from(this.recursosSelecionados()),
      interesses: this.interesses(),
      avatar: this.avatarSelecionado()
    };

    this.usuarioService.cadastrar(dados).subscribe({
      next: () => {
        this.enviando.set(false);
        this.roteador.navigate(['/login']);
      },
      error: (erro: HttpErrorResponse) => {
        this.enviando.set(false);

        if (erro.status === 409) {
          this.erroFormulario.set(erro.error?.mensagem ?? 'CPF ou e-mail já cadastrado.');
          this.etapa.set(1);
          return;
        }

        this.erroFormulario.set(
          erro.error?.mensagem ?? 'Não foi possível concluir o cadastro. Tente novamente.'
        );
      }
    });
  }
}
