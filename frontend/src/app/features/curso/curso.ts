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

import { AuthService } from '../../shared/services/auth.service';
import { CursoService } from '../../shared/services/curso.service';
import { Curso as CursoModelo, NovoCurso, TipoConteudoCurso } from '../../shared/types/curso';
import { formatarCargaHorariaCurso, formatarPrecoCurso } from '../../shared/utils/curso-format';

const REGEX_URL = /^https?:\/\/.+/i;

/** No modo LINK, exige uma URL válida; no modo ARQUIVO, a checagem do arquivo é feita à parte. */
function conteudoValido(grupo: AbstractControl): ValidationErrors | null {
  const tipoConteudo = grupo.get('tipoConteudo')?.value as TipoConteudoCurso;
  const linkCurso = grupo.get('linkCurso')?.value as string;

  if (tipoConteudo === 'LINK' && !REGEX_URL.test(linkCurso ?? '')) {
    return { linkObrigatorio: true };
  }

  return null;
}

/** Tela de cursos da empresa: cadastro (link ou vídeo anexado) e lista dos já publicados. */
@Component({
  selector: 'app-curso',
  imports: [ReactiveFormsModule],
  templateUrl: './curso.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Curso {
  private readonly cursoService = inject(CursoService);
  private readonly authService = inject(AuthService);

  protected readonly cursos = signal<CursoModelo[]>([]);
  protected readonly carregando = signal(true);
  protected readonly enviando = signal(false);
  protected readonly erroLista = signal<string | null>(null);
  protected readonly erroFormulario = signal<string | null>(null);

  /** Presente só durante a edição de um curso já cadastrado. */
  protected readonly idCursoEditando = signal<number | null>(null);
  protected readonly arquivoSelecionado = signal<File | null>(null);
  /** Nome do vídeo já cadastrado, exibido na edição enquanto nenhum arquivo novo é escolhido. */
  protected readonly arquivoAtualUrl = signal<string | null>(null);

  protected readonly formulario = new FormGroup(
    {
      titulo: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(3)]
      }),
      cargaHoraria: new FormControl<number | null>(null),
      preco: new FormControl<number | null>(null),
      tipoConteudo: new FormControl<TipoConteudoCurso>('LINK', { nonNullable: true }),
      linkCurso: new FormControl('', { nonNullable: true }),
      descricao: new FormControl('', { nonNullable: true })
    },
    { validators: [conteudoValido] }
  );

  constructor() {
    this.carregarCursos();
  }

  /** Garantido pelo ambienteGuard('empresa'): só entra aqui quem está logado como empresa. */
  private idEmpresaLogada(): number {
    const sessao = this.authService.sessao();
    return sessao?.ambiente === 'empresa' ? sessao.perfil.id : 0;
  }

  private carregarCursos(): void {
    this.carregando.set(true);
    this.erroLista.set(null);

    this.cursoService.listar(this.idEmpresaLogada()).subscribe({
      next: (cursos) => {
        this.cursos.set(cursos);
        this.carregando.set(false);
      },
      error: () => {
        this.erroLista.set('Não foi possível carregar os cursos. Tente novamente.');
        this.carregando.set(false);
      }
    });
  }

  protected temErro(campo: 'titulo' | 'cargaHoraria' | 'preco'): boolean {
    const controle = this.formulario.controls[campo];
    return controle.invalid && (controle.touched || controle.dirty);
  }

  protected temErroDeLink(): boolean {
    const controle = this.formulario.controls.linkCurso;
    return this.formulario.hasError('linkObrigatorio') && (controle.touched || controle.dirty);
  }

  protected alternarTipoConteudo(tipo: TipoConteudoCurso): void {
    this.formulario.controls.tipoConteudo.setValue(tipo);
  }

  protected selecionarArquivo(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    this.arquivoSelecionado.set(entrada.files?.[0] ?? null);
  }

  protected precisaDeArquivoNovo(): boolean {
    return (
      this.formulario.controls.tipoConteudo.value === 'ARQUIVO' &&
      this.arquivoSelecionado() === null &&
      this.arquivoAtualUrl() === null
    );
  }

  protected aoClicarEditar(curso: CursoModelo): void {
    this.erroFormulario.set(null);
    this.idCursoEditando.set(curso.id);
    this.arquivoSelecionado.set(null);
    this.arquivoAtualUrl.set(curso.arquivoCursoUrl);

    this.formulario.setValue({
      titulo: curso.titulo,
      cargaHoraria: curso.cargaHoraria,
      preco: curso.preco,
      tipoConteudo: curso.tipoConteudo,
      linkCurso: curso.linkCurso ?? '',
      descricao: curso.descricao ?? ''
    });
  }

  protected aoCancelarEdicao(): void {
    this.idCursoEditando.set(null);
    this.arquivoSelecionado.set(null);
    this.arquivoAtualUrl.set(null);
    this.erroFormulario.set(null);
    this.formulario.reset({
      titulo: '',
      cargaHoraria: null,
      preco: null,
      tipoConteudo: 'LINK',
      linkCurso: '',
      descricao: ''
    });
  }

  protected aoEnviar(): void {
    this.erroFormulario.set(null);

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.erroFormulario.set('Revise os campos destacados antes de continuar.');
      return;
    }

    if (this.precisaDeArquivoNovo()) {
      this.erroFormulario.set('Anexe um vídeo ou troque para cadastrar com um link.');
      return;
    }

    this.enviando.set(true);
    const valores = this.formulario.getRawValue();

    const dados: NovoCurso = {
      titulo: valores.titulo,
      descricao: valores.descricao || null,
      cargaHoraria: valores.cargaHoraria,
      preco: valores.preco,
      tipoConteudo: valores.tipoConteudo,
      linkCurso: valores.tipoConteudo === 'LINK' ? valores.linkCurso : null,
      arquivo: valores.tipoConteudo === 'ARQUIVO' ? this.arquivoSelecionado() : null
    };

    const idEditando = this.idCursoEditando();
    const idEmpresa = this.idEmpresaLogada();
    const operacao =
      idEditando !== null
        ? this.cursoService.atualizar(idEditando, dados, idEmpresa)
        : this.cursoService.cadastrar(dados, idEmpresa);

    operacao.subscribe({
      next: (curso) => {
        this.enviando.set(false);
        this.cursos.update((lista) =>
          idEditando !== null
            ? lista.map((item) => (item.id === curso.id ? curso : item))
            : [curso, ...lista]
        );
        this.aoCancelarEdicao();
      },
      error: (erro: HttpErrorResponse) => {
        this.enviando.set(false);
        this.erroFormulario.set(
          erro.error?.mensagem ??
            (idEditando !== null
              ? 'Não foi possível salvar as alterações. Tente novamente.'
              : 'Não foi possível cadastrar o curso. Tente novamente.')
        );
      }
    });
  }

  protected formatarCargaHoraria(curso: CursoModelo): string {
    return formatarCargaHorariaCurso(curso.cargaHoraria);
  }

  protected formatarPreco(curso: CursoModelo): string {
    return formatarPrecoCurso(curso.preco);
  }
}
