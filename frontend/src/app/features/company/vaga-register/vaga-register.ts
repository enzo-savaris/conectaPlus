import { ChangeDetectionStrategy, Component, WritableSignal, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, debounceTime, of, switchMap } from 'rxjs';

import { AuthService } from '../../../shared/services/auth.service';
import { CidadeService } from '../../../shared/services/cidade.service';
import { CursoService } from '../../../shared/services/curso.service';
import { VagaService } from '../../../shared/services/vaga.service';
import { Cidade } from '../../../shared/types/cidade';
import { Curso } from '../../../shared/types/curso';
import { ModeloTrabalho, NovaVaga, TipoContratacao } from '../../../shared/types/vaga';
import { formatarCargaHorariaCurso, formatarPrecoCurso } from '../../../shared/utils/curso-format';
import { apenasDigitos, formatarCep } from '../../../shared/utils/masks';

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
  private readonly rota = inject(ActivatedRoute);
  private readonly vagaService = inject(VagaService);
  private readonly cursoService = inject(CursoService);
  private readonly cidadeService = inject(CidadeService);
  private readonly authService = inject(AuthService);

  /** Presente só na rota de edição (`empresa/vagas/:id/editar`). */
  protected readonly idVagaEditando = signal<number | null>(null);
  protected readonly modoEdicao = computed(() => this.idVagaEditando() !== null);
  protected readonly carregandoVaga = signal(false);

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
      tipoContratacao: new FormControl<TipoContratacao>('CLT', { nonNullable: true }),
      cep: new FormControl('', { nonNullable: true }),
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

  protected readonly cursosDaEmpresa = signal<Curso[]>([]);
  protected readonly cursosSelecionados = signal<ReadonlySet<number>>(new Set());

  /** Combobox de cidade: busca por nome (typeahead) ou preenchida automaticamente pelo CEP. */
  protected readonly termoBuscaCidade = signal('');
  protected readonly resultadosCidade = signal<Cidade[]>([]);
  protected readonly mostrarResultadosCidade = signal(false);
  protected readonly buscandoCidade = signal(false);
  protected readonly cidadeSelecionada = signal<Cidade | null>(null);
  protected readonly erroCep = signal<string | null>(null);
  private readonly buscaCidadeSubject = new Subject<string>();

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

  constructor() {
    this.cursoService.listar(this.idEmpresaLogada()).subscribe((cursos) => this.cursosDaEmpresa.set(cursos));

    this.buscaCidadeSubject
      .pipe(
        debounceTime(300),
        switchMap((termo) => (termo.length >= 2 ? this.cidadeService.buscar(termo) : of([])))
      )
      .subscribe((cidades) => {
        this.resultadosCidade.set(cidades);
        this.buscandoCidade.set(false);
      });

    const idParam = this.rota.snapshot.paramMap.get('id');

    if (idParam) {
      const idVaga = Number(idParam);
      this.idVagaEditando.set(idVaga);
      this.carregarVagaParaEdicao(idVaga);
    }
  }

  /** Garantido pelo ambienteGuard('empresa'): só entra aqui quem está logado como empresa. */
  private idEmpresaLogada(): number {
    const sessao = this.authService.sessao();
    return sessao?.ambiente === 'empresa' ? sessao.perfil.id : 0;
  }

  protected formatarCargaHorariaCurso(curso: Curso): string {
    return formatarCargaHorariaCurso(curso.cargaHoraria);
  }

  protected formatarPrecoCurso(curso: Curso): string {
    return formatarPrecoCurso(curso.preco);
  }

  protected cursoEstaSelecionado(idCurso: number): boolean {
    return this.cursosSelecionados().has(idCurso);
  }

  protected alternarCursoRecomendado(idCurso: number): void {
    this.cursosSelecionados.update((atual) => {
      const novo = new Set(atual);
      if (novo.has(idCurso)) {
        novo.delete(idCurso);
      } else {
        novo.add(idCurso);
      }
      return novo;
    });
  }

  /** Aplica a máscara do CEP e, com os 8 dígitos completos, já busca a cidade automaticamente. */
  protected aplicarMascaraCep(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const mascarado = formatarCep(entrada.value);

    entrada.value = mascarado;
    this.formulario.controls.cep.setValue(mascarado, { emitEvent: false });

    const digitos = apenasDigitos(mascarado);
    if (digitos.length === 8) {
      this.buscarCidadePorCep(digitos);
    }
  }

  private buscarCidadePorCep(cep: string): void {
    this.erroCep.set(null);
    this.buscandoCidade.set(true);

    this.cidadeService.buscarPorCep(cep).subscribe({
      next: (cidade) => {
        this.buscandoCidade.set(false);
        this.selecionarCidade(cidade);
      },
      error: () => {
        this.buscandoCidade.set(false);
        this.erroCep.set('CEP não encontrado.');
      }
    });
  }

  /** Digitar no campo de cidade dispara a busca (com debounce) e desfaz a seleção anterior. */
  protected aoDigitarCidade(evento: Event): void {
    const termo = (evento.target as HTMLInputElement).value;
    this.termoBuscaCidade.set(termo);
    this.cidadeSelecionada.set(null);
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

  protected selecionarCidade(cidade: Cidade): void {
    this.cidadeSelecionada.set(cidade);
    this.termoBuscaCidade.set(`${cidade.nome} - ${cidade.estado}`);
    this.mostrarResultadosCidade.set(false);
    this.resultadosCidade.set([]);
  }

  private carregarVagaParaEdicao(idVaga: number): void {
    this.carregandoVaga.set(true);
    this.erroFormulario.set(null);

    this.vagaService.obterPorId(idVaga).subscribe({
      next: (vaga) => {
        this.formulario.patchValue({
          titulo: vaga.titulo,
          tipoContratacao: vaga.tipoContratacao,
          modeloTrabalho: vaga.modeloTrabalho,
          salarioMinimo: vaga.salarioMinimo,
          salarioMaximo: vaga.salarioMaximo,
          descricao: vaga.descricao
        });

        if (vaga.idCidade !== null && vaga.cidade !== null && vaga.estado !== null) {
          this.selecionarCidade({ id: vaga.idCidade, nome: vaga.cidade, estado: vaga.estado });
        }

        this.responsabilidades.set(vaga.responsabilidades);
        this.requisitos.set(vaga.requisitos);
        this.acessibilidade.set(vaga.acessibilidade);
        this.beneficios.set(vaga.beneficios);
        this.cursosSelecionados.set(new Set(vaga.cursosRecomendados.map((curso) => curso.id)));
        this.carregandoVaga.set(false);
      },
      error: () => {
        this.carregandoVaga.set(false);
        this.erroFormulario.set('Não foi possível carregar os dados da vaga.');
      }
    });
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
    const dados: NovaVaga = {
      titulo: valores.titulo,
      area: null,
      descricao: valores.descricao,
      idCidade: this.cidadeSelecionada()?.id ?? null,
      modeloTrabalho: valores.modeloTrabalho,
      tipoContratacao: valores.tipoContratacao,
      salarioMinimo: valores.salarioMinimo,
      salarioMaximo: valores.salarioMaximo,
      responsabilidades: this.responsabilidades(),
      requisitos: this.requisitos(),
      acessibilidade: this.acessibilidade(),
      beneficios: this.beneficios(),
      cursosRecomendados: Array.from(this.cursosSelecionados())
    };

    const idEditando = this.idVagaEditando();
    const operacao =
      idEditando !== null
        ? this.vagaService.atualizar(idEditando, dados, this.idEmpresaLogada())
        : this.vagaService.cadastrar(dados, this.idEmpresaLogada());

    operacao.subscribe({
      next: () => {
        this.enviando.set(false);
        this.roteador.navigate(['/vagas']);
      },
      error: () => {
        this.enviando.set(false);
        this.erroFormulario.set(
          idEditando !== null
            ? 'Não foi possível salvar as alterações. Tente novamente.'
            : 'Não foi possível publicar a vaga. Tente novamente.'
        );
      }
    });
  }
}
