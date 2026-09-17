import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { Subject, debounceTime, of, switchMap } from 'rxjs';

import { AuthService } from '../../shared/services/auth.service';
import { CidadeService } from '../../shared/services/cidade.service';
import { UsuarioService } from '../../shared/services/usuario.service';
import {
  AtualizarPerfilCandidato,
  ExperienciaEmEdicao,
  FormacaoEmEdicao,
  PerfilCandidato,
  TipoCurriculo,
  TipoDeficiencia
} from '../../shared/types/candidato';
import { Cidade } from '../../shared/types/cidade';
import { formatarTelefone } from '../../shared/utils/masks';
import { validadorTelefone } from '../../shared/validators/br-validators';

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

/** Garante que as duas senhas digitadas conferem, quando alguma foi preenchida. */
function senhasConferem(grupo: AbstractControl): ValidationErrors | null {
  const novaSenha = grupo.get('novaSenha')?.value;
  const confirmarSenha = grupo.get('confirmarSenha')?.value;

  if (!novaSenha && !confirmarSenha) {
    return null;
  }

  return novaSenha === confirmarSenha ? null : { senhasDiferentes: true };
}

/** Tela de perfil do candidato PCD: dados reais do banco, editáveis só no modo edição. */
@Component({
  selector: 'app-perfil',
  imports: [ReactiveFormsModule],
  templateUrl: './perfil.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Perfil {
  private readonly usuarioService = inject(UsuarioService);
  private readonly authService = inject(AuthService);
  private readonly cidadeService = inject(CidadeService);

  protected readonly tiposDeficiencia = TIPOS_DEFICIENCIA;
  protected readonly recursosDisponiveis = RECURSOS_DISPONIVEIS;

  protected readonly perfil = signal<PerfilCandidato | null>(null);
  protected readonly modoEdicao = signal(false);
  protected readonly carregando = signal(true);
  protected readonly salvando = signal(false);
  protected readonly senhaVisivel = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly sucesso = signal<string | null>(null);

  protected readonly avatarSelecionado = signal<File | null>(null);
  protected readonly avatarPreviewUrl = signal<string | null>(null);
  protected readonly curriculoPdfSelecionado = signal<File | null>(null);

  protected readonly tipoDeficienciaSelecionado = signal<TipoDeficiencia | null>(null);
  protected readonly recursosSelecionados = signal<ReadonlySet<string>>(new Set());
  protected readonly interesses = signal<string[]>([]);
  protected readonly habilidades = signal<string[]>([]);
  protected readonly tipoCurriculo = signal<TipoCurriculo>('PLATAFORMA');
  protected readonly experienciasEmEdicao = signal<ExperienciaEmEdicao[]>([]);
  protected readonly formacoesEmEdicao = signal<FormacaoEmEdicao[]>([]);

  /** Combobox de cidade: busca por nome (typeahead) e preenche o Estado (UF) ao selecionar. */
  protected readonly resultadosCidade = signal<Cidade[]>([]);
  protected readonly mostrarResultadosCidade = signal(false);
  protected readonly buscandoCidade = signal(false);
  private readonly buscaCidadeSubject = new Subject<string>();

  protected readonly formulario = new FormGroup(
    {
      nome: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3)] }),
      tituloProfissional: new FormControl('', { nonNullable: true }),
      email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
      telefone: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, validadorTelefone()]
      }),
      cidade: new FormControl('', { nonNullable: true }),
      estado: new FormControl('', { nonNullable: true }),
      sobreMim: new FormControl('', { nonNullable: true }),
      novaSenha: new FormControl('', { nonNullable: true, validators: [Validators.minLength(8)] }),
      confirmarSenha: new FormControl('', { nonNullable: true })
    },
    { validators: [senhasConferem] }
  );

  constructor() {
    this.formulario.disable();
    this.carregarPerfil();

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

  /** Garantido pelo ambienteGuard('usuario'): só entra aqui quem está logado como candidato. */
  private idCandidatoLogado(): number {
    const sessao = this.authService.sessao();
    return sessao?.ambiente === 'usuario' ? sessao.perfil.id : 0;
  }

  private carregarPerfil(): void {
    this.carregando.set(true);
    this.erro.set(null);

    this.usuarioService.obterPorId(this.idCandidatoLogado()).subscribe({
      next: (perfil) => {
        this.perfil.set(perfil);
        this.preencherFormulario(perfil);
        this.carregando.set(false);
      },
      error: () => {
        this.erro.set('Não foi possível carregar os dados do perfil.');
        this.carregando.set(false);
      }
    });
  }

  private preencherFormulario(perfil: PerfilCandidato): void {
    this.formulario.reset({
      nome: perfil.nome,
      tituloProfissional: perfil.tituloProfissional ?? '',
      email: perfil.email ?? '',
      telefone: perfil.telefone ? formatarTelefone(perfil.telefone) : '',
      cidade: perfil.cidade ?? '',
      estado: perfil.estado ?? '',
      sobreMim: perfil.sobreMim ?? '',
      novaSenha: '',
      confirmarSenha: ''
    });
    this.formulario.disable();

    this.avatarSelecionado.set(null);
    this.avatarPreviewUrl.set(null);
    this.curriculoPdfSelecionado.set(null);
    this.tipoDeficienciaSelecionado.set(perfil.tipoDeficiencia);
    this.recursosSelecionados.set(new Set(perfil.recursos));
    this.interesses.set([...perfil.interesses]);
    this.habilidades.set([...perfil.habilidades]);
    this.tipoCurriculo.set(perfil.tipoCurriculo);
    this.experienciasEmEdicao.set(
      perfil.experiencias.map((exp) => ({
        cargo: exp.cargo,
        empresa: exp.empresa,
        periodo: exp.periodo ?? '',
        descricao: exp.descricao ?? ''
      }))
    );
    this.formacoesEmEdicao.set(
      perfil.formacoes.map((form) => ({
        curso: form.curso,
        instituicao: form.instituicao,
        periodo: form.periodo ?? ''
      }))
    );
    this.mostrarResultadosCidade.set(false);
    this.resultadosCidade.set([]);
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

  protected aplicarMascaraTelefone(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const mascarado = formatarTelefone(entrada.value);

    entrada.value = mascarado;
    this.formulario.controls.telefone.setValue(mascarado, { emitEvent: false });
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

  protected selecionarCurriculoPdf(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    this.curriculoPdfSelecionado.set(entrada.files?.[0] ?? null);
  }

  protected alternarTipoCurriculo(tipo: TipoCurriculo): void {
    this.tipoCurriculo.set(tipo);
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

  protected adicionarHabilidade(entrada: HTMLInputElement): void {
    const valor = entrada.value.trim();
    if (!valor) {
      return;
    }
    this.habilidades.update((lista) => (lista.includes(valor) ? lista : [...lista, valor]));
    entrada.value = '';
    entrada.focus();
  }

  protected removerHabilidade(indice: number): void {
    this.habilidades.update((lista) => lista.filter((_, i) => i !== indice));
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

  protected aoDesfocarCampoCidade(): void {
    setTimeout(() => this.mostrarResultadosCidade.set(false), 150);
  }

  protected selecionarCidade(cidade: Cidade): void {
    this.formulario.controls.cidade.setValue(cidade.nome);
    this.formulario.controls.estado.setValue(cidade.estado);
    this.mostrarResultadosCidade.set(false);
    this.resultadosCidade.set([]);
  }

  protected adicionarExperiencia(
    cargoInput: HTMLInputElement,
    empresaInput: HTMLInputElement,
    periodoInput: HTMLInputElement,
    descricaoInput: HTMLTextAreaElement
  ): void {
    const cargo = cargoInput.value.trim();
    const empresa = empresaInput.value.trim();

    if (!cargo || !empresa) {
      this.erro.set('Informe ao menos o cargo e a empresa para adicionar a experiência.');
      return;
    }

    this.experienciasEmEdicao.update((lista) => [
      ...lista,
      { cargo, empresa, periodo: periodoInput.value.trim(), descricao: descricaoInput.value.trim() }
    ]);

    cargoInput.value = '';
    empresaInput.value = '';
    periodoInput.value = '';
    descricaoInput.value = '';
    this.erro.set(null);
  }

  protected removerExperiencia(indice: number): void {
    this.experienciasEmEdicao.update((lista) => lista.filter((_, i) => i !== indice));
  }

  protected adicionarFormacao(
    cursoInput: HTMLInputElement,
    instituicaoInput: HTMLInputElement,
    periodoInput: HTMLInputElement
  ): void {
    const curso = cursoInput.value.trim();
    const instituicao = instituicaoInput.value.trim();

    if (!curso || !instituicao) {
      this.erro.set('Informe ao menos o curso e a instituição para adicionar a formação.');
      return;
    }

    this.formacoesEmEdicao.update((lista) => [...lista, { curso, instituicao, periodo: periodoInput.value.trim() }]);

    cursoInput.value = '';
    instituicaoInput.value = '';
    periodoInput.value = '';
    this.erro.set(null);
  }

  protected removerFormacao(indice: number): void {
    this.formacoesEmEdicao.update((lista) => lista.filter((_, i) => i !== indice));
  }

  protected aoClicarEditar(): void {
    this.sucesso.set(null);
    this.erro.set(null);
    this.modoEdicao.set(true);
    this.formulario.enable();
  }

  protected aoCancelar(): void {
    const perfil = this.perfil();
    if (perfil) {
      this.preencherFormulario(perfil);
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

    if (this.tipoDeficienciaSelecionado() === null) {
      this.erro.set('Selecione o tipo de deficiência.');
      return;
    }

    const precisaDeCurriculoNovo =
      this.tipoCurriculo() === 'PDF' && !this.curriculoPdfSelecionado() && !this.perfil()?.curriculoPdfUrl;

    if (precisaDeCurriculoNovo) {
      this.erro.set('Anexe um PDF ou troque para montar o currículo pela plataforma.');
      return;
    }

    this.salvando.set(true);
    const valores = this.formulario.getRawValue();

    const dados: AtualizarPerfilCandidato = {
      nome: valores.nome,
      tituloProfissional: valores.tituloProfissional || null,
      email: valores.email,
      telefone: valores.telefone,
      cidade: valores.cidade || null,
      estado: valores.estado || null,
      sobreMim: valores.sobreMim || null,
      tipoDeficiencia: this.tipoDeficienciaSelecionado()!,
      recursos: Array.from(this.recursosSelecionados()),
      interesses: this.interesses(),
      tipoCurriculo: this.tipoCurriculo(),
      habilidades: this.habilidades(),
      experiencias: this.experienciasEmEdicao(),
      formacoes: this.formacoesEmEdicao()
    };

    if (valores.novaSenha) {
      dados.senha = valores.novaSenha;
    }

    const avatar = this.avatarSelecionado();
    if (avatar) {
      dados.avatar = avatar;
    }

    const curriculoPdf = this.curriculoPdfSelecionado();
    if (this.tipoCurriculo() === 'PDF' && curriculoPdf) {
      dados.curriculoPdf = curriculoPdf;
    }

    this.usuarioService.atualizar(this.idCandidatoLogado(), dados).subscribe({
      next: (perfil) => {
        this.perfil.set(perfil);
        this.preencherFormulario(perfil);
        this.modoEdicao.set(false);
        this.salvando.set(false);
        this.sucesso.set('Perfil atualizado com sucesso.');
      },
      error: (erro: HttpErrorResponse) => {
        this.salvando.set(false);
        this.erro.set(erro.error?.mensagem ?? 'Não foi possível salvar as alterações. Tente novamente.');
      }
    });
  }
}
