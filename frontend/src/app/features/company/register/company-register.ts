import { afterNextRender, ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, debounceTime, of, switchMap } from 'rxjs';
import { CidadeService } from '../../../shared/services/cidade.service';
import { EmpresaService } from '../../../shared/services/empresa.service';
import { Cidade } from '../../../shared/types/cidade';
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
  private readonly empresaService = inject(EmpresaService);
  private readonly cidadeService = inject(CidadeService);

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
    })
  });

  protected readonly senhaVisivel = signal(false);
  protected readonly enviando = signal(false);
  protected readonly erroFormulario = signal<string | null>(null);

  /**
   * Combobox de cidade: busca por nome (typeahead) nas cidades já cadastradas
   * e, ao selecionar uma, preenche o Estado (UF) automaticamente. O CEP não
   * preenche mais a cidade sozinho — cidade/estado da empresa são texto
   * livre, então quem resolve a UF é a cidade escolhida, não o CEP.
   */
  protected readonly resultadosCidade = signal<Cidade[]>([]);
  protected readonly mostrarResultadosCidade = signal(false);
  protected readonly buscandoCidade = signal(false);
  private readonly buscaCidadeSubject = new Subject<string>();

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

    this.buscaCidadeSubject
      .pipe(
        debounceTime(300),
        switchMap((termo) => (termo.length >= 2 ? this.cidadeService.buscar(termo) : of([])))
      )
      .subscribe((cidades) => {
        this.resultadosCidade.set(cidades);
        this.buscandoCidade.set(false);
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

  /** Digitar no campo de cidade dispara a busca (com debounce) nas cidades já cadastradas. */
  protected aoDigitarCidade(evento: Event): void {
    const termo = (evento.target as HTMLInputElement).value;
    this.formulario.controls.cidade.setValue(termo, { emitEvent: false });
    this.mostrarResultadosCidade.set(true);

    if (termo.trim().length >= 2) {
      this.buscandoCidade.set(true);
      this.buscaCidadeSubject.next(termo.trim());
    } else {
      this.resultadosCidade.set([]);
      this.buscandoCidade.set(false);
    }
  }

  protected aoFocarCampoCidade(): void {
    if (this.resultadosCidade().length > 0) {
      this.mostrarResultadosCidade.set(true);
    }
  }

  /** Pequeno atraso pra deixar o clique num item da lista acontecer antes de escondê-la. */
  protected aoDesfocarCampoCidade(): void {
    setTimeout(() => this.mostrarResultadosCidade.set(false), 150);
  }

  /** Preenche cidade e, a partir dela, o Estado (UF) automaticamente. */
  protected selecionarCidade(cidade: Cidade): void {
    this.formulario.controls.cidade.setValue(cidade.nome);
    this.formulario.controls.estado.setValue(cidade.estado);
    this.mostrarResultadosCidade.set(false);
    this.resultadosCidade.set([]);
  }

  protected aoCancelar(): void {
    this.roteador.navigate(['/login']);
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

    this.empresaService
      .cadastrar({
        razaoSocial: valores.razaoSocial,
        nomeFantasia: valores.nomeFantasia || null,
        cnpj: valores.cnpj,
        email: valores.email,
        telefone: valores.telefone || null,
        cep: valores.cep,
        numero: valores.numero,
        complemento: valores.complemento || null,
        bairro: valores.bairro || null,
        cidade: valores.cidade || null,
        estado: valores.estado || null,
        senha: valores.senha
      })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.roteador.navigate(['/empresa/aguardando-confirmacao']);
        },
        error: (erro: HttpErrorResponse) => {
          this.enviando.set(false);
          this.erroFormulario.set(
            erro.status === 409
              ? (erro.error?.mensagem ?? 'CNPJ ou e-mail já cadastrado.')
              : 'Não foi possível concluir o cadastro. Tente novamente.'
          );
        }
      });
  }
}
