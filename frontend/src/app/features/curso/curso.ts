import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { AuthService } from '../../shared/services/auth.service';
import { CursoService } from '../../shared/services/curso.service';
import { ToastService } from '../../shared/services/toast.service';
import { Curso as CursoModelo, NovoCurso, NovoModulo, TipoConteudoCurso } from '../../shared/types/curso';
import { formatarCargaHorariaCurso, formatarPrecoCurso } from '../../shared/utils/curso-format';

const REGEX_URL = /^https?:\/\/.+/i;

/** Estado de edição de uma aula: espelha `NovoCapitulo`, mas com string vazia em vez de null nos campos de texto (mais fácil de ligar ao input). */
interface CapituloEmEdicao {
  titulo: string;
  tipoConteudo: TipoConteudoCurso;
  linkCapitulo: string;
  arquivo: File | null;
  /** Nome do vídeo já cadastrado (edição) e sua URL só para exibir o nome ao usuário. */
  arquivoAtual: string | null;
  arquivoAtualNome: string | null;
}

interface ModuloEmEdicao {
  titulo: string;
  capitulos: CapituloEmEdicao[];
}

function criarCapituloVazio(): CapituloEmEdicao {
  return {
    titulo: '',
    tipoConteudo: 'LINK',
    linkCapitulo: '',
    arquivo: null,
    arquivoAtual: null,
    arquivoAtualNome: null
  };
}

function criarModuloVazio(): ModuloEmEdicao {
  return { titulo: '', capitulos: [criarCapituloVazio()] };
}

/** Extrai o nome do arquivo a partir da URL pronta que a API devolve (.../uploads/cursos/<nome>). */
function nomeArquivoDaUrl(url: string): string {
  return url.split('/').pop() ?? url;
}

/** Tela de cursos da empresa: cadastro por módulos e aulas, e lista dos já publicados. */
@Component({
  selector: 'app-curso',
  imports: [ReactiveFormsModule],
  templateUrl: './curso.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Curso {
  private readonly cursoService = inject(CursoService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);

  protected readonly cursos = signal<CursoModelo[]>([]);
  protected readonly carregando = signal(true);
  protected readonly enviando = signal(false);
  protected readonly carregandoEdicao = signal(false);
  protected readonly erroLista = signal<string | null>(null);
  protected readonly erroFormulario = signal<string | null>(null);

  /**
   * Só empresa ATIVA pode cadastrar/editar cursos; PENDENTE (ex.: depois de
   * mudar CNPJ/razão social) ou INATIVA só pode visualizar os já cadastrados.
   */
  protected readonly empresaAtiva = computed(() => {
    const sessao = this.authService.sessao();
    return sessao?.ambiente !== 'empresa' || sessao.perfil.status === 'ATIVA';
  });

  /** Presente só durante a edição de um curso já cadastrado. */
  protected readonly idCursoEditando = signal<number | null>(null);
  protected readonly modulos = signal<ModuloEmEdicao[]>([criarModuloVazio()]);

  protected readonly formulario = new FormGroup({
    titulo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3)]
    }),
    cargaHoraria: new FormControl<number | null>(null),
    preco: new FormControl<number | null>(null),
    descricao: new FormControl('', { nonNullable: true })
  });

  constructor() {
    this.carregarCursos();

    // Mantém o formulário em sincronia com o status da empresa: se ela deixar
    // de estar ATIVA (ex.: editou CNPJ/razão social) enquanto a tela já está
    // aberta, os campos ficam cinza/desabilitados na hora, sem precisar de F5.
    effect(() => {
      if (this.empresaAtiva()) {
        this.formulario.enable({ emitEvent: false });
      } else {
        this.formulario.disable({ emitEvent: false });
      }
    });
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

  // ============ MÓDULOS ============

  protected adicionarModulo(): void {
    this.modulos.update((lista) => [...lista, criarModuloVazio()]);
  }

  protected removerModulo(indiceModulo: number): void {
    this.modulos.update((lista) => lista.filter((_, i) => i !== indiceModulo));
  }

  protected atualizarTituloModulo(indiceModulo: number, valor: string): void {
    this.modulos.update((lista) =>
      lista.map((modulo, i) => (i === indiceModulo ? { ...modulo, titulo: valor } : modulo))
    );
  }

  // ============ CAPÍTULOS (AULAS) ============

  protected adicionarCapitulo(indiceModulo: number): void {
    this.modulos.update((lista) =>
      lista.map((modulo, i) =>
        i === indiceModulo ? { ...modulo, capitulos: [...modulo.capitulos, criarCapituloVazio()] } : modulo
      )
    );
  }

  protected removerCapitulo(indiceModulo: number, indiceCapitulo: number): void {
    this.modulos.update((lista) =>
      lista.map((modulo, i) =>
        i === indiceModulo
          ? { ...modulo, capitulos: modulo.capitulos.filter((_, j) => j !== indiceCapitulo) }
          : modulo
      )
    );
  }

  private atualizarCapitulo(
    indiceModulo: number,
    indiceCapitulo: number,
    patch: Partial<CapituloEmEdicao>
  ): void {
    this.modulos.update((lista) =>
      lista.map((modulo, i) =>
        i === indiceModulo
          ? {
              ...modulo,
              capitulos: modulo.capitulos.map((capitulo, j) =>
                j === indiceCapitulo ? { ...capitulo, ...patch } : capitulo
              )
            }
          : modulo
      )
    );
  }

  protected atualizarTituloCapitulo(indiceModulo: number, indiceCapitulo: number, valor: string): void {
    this.atualizarCapitulo(indiceModulo, indiceCapitulo, { titulo: valor });
  }

  protected atualizarLinkCapitulo(indiceModulo: number, indiceCapitulo: number, valor: string): void {
    this.atualizarCapitulo(indiceModulo, indiceCapitulo, { linkCapitulo: valor });
  }

  protected alternarTipoConteudoCapitulo(
    indiceModulo: number,
    indiceCapitulo: number,
    tipo: TipoConteudoCurso
  ): void {
    this.atualizarCapitulo(indiceModulo, indiceCapitulo, { tipoConteudo: tipo });
  }

  protected selecionarArquivoCapitulo(indiceModulo: number, indiceCapitulo: number, evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    this.atualizarCapitulo(indiceModulo, indiceCapitulo, { arquivo: entrada.files?.[0] ?? null });
  }

  /** Falta um vídeo nessa aula: nem veio um novo, nem já havia um cadastrado (edição). */
  protected precisaDeArquivoNovo(capitulo: CapituloEmEdicao): boolean {
    return capitulo.tipoConteudo === 'ARQUIVO' && capitulo.arquivo === null && capitulo.arquivoAtual === null;
  }

  // ============ CADASTRO / EDIÇÃO / ENVIO ============

  protected aoClicarEditar(curso: CursoModelo): void {
    this.erroFormulario.set(null);
    this.carregandoEdicao.set(true);
    this.idCursoEditando.set(curso.id);

    this.cursoService.obterPorId(curso.id).subscribe({
      next: (detalhado) => {
        this.carregandoEdicao.set(false);

        this.formulario.setValue({
          titulo: detalhado.titulo,
          cargaHoraria: detalhado.cargaHoraria,
          preco: detalhado.preco,
          descricao: detalhado.descricao ?? ''
        });

        this.modulos.set(
          detalhado.modulos.map((modulo) => ({
            titulo: modulo.titulo,
            capitulos: modulo.capitulos.map((capitulo) => ({
              titulo: capitulo.titulo,
              tipoConteudo: capitulo.tipoConteudo,
              linkCapitulo: capitulo.linkCapitulo ?? '',
              arquivo: null,
              arquivoAtual: capitulo.arquivoCapituloUrl ? nomeArquivoDaUrl(capitulo.arquivoCapituloUrl) : null,
              arquivoAtualNome: capitulo.arquivoCapituloUrl ? nomeArquivoDaUrl(capitulo.arquivoCapituloUrl) : null
            }))
          }))
        );
      },
      error: () => {
        this.carregandoEdicao.set(false);
        this.erroFormulario.set('Não foi possível carregar esse curso para edição.');
        this.idCursoEditando.set(null);
      }
    });
  }

  /** Limpa o formulário — tanto pra sair da edição quanto pra descartar um cadastro novo em andamento. */
  protected aoCancelar(): void {
    this.idCursoEditando.set(null);
    this.erroFormulario.set(null);
    this.modulos.set([criarModuloVazio()]);
    this.formulario.reset({ titulo: '', cargaHoraria: null, preco: null, descricao: '' });
  }

  /** Valida módulos e capítulos no cliente; o servidor repete tudo isso, mas aqui dá feedback na hora. */
  private validarModulosLocalmente(): string | null {
    const modulos = this.modulos();

    if (modulos.length === 0) {
      return 'Cadastre ao menos um módulo.';
    }

    for (const modulo of modulos) {
      if (modulo.titulo.trim().length < 3) {
        return 'Todo módulo precisa de um título com ao menos 3 caracteres.';
      }
      if (modulo.capitulos.length === 0) {
        return `Cadastre ao menos uma aula no módulo "${modulo.titulo}".`;
      }

      for (const capitulo of modulo.capitulos) {
        if (capitulo.titulo.trim().length < 3) {
          return 'Toda aula precisa de um título com ao menos 3 caracteres.';
        }
        if (capitulo.tipoConteudo === 'LINK' && !REGEX_URL.test(capitulo.linkCapitulo)) {
          return `Informe um link válido para a aula "${capitulo.titulo}".`;
        }
        if (this.precisaDeArquivoNovo(capitulo)) {
          return `Anexe um vídeo para a aula "${capitulo.titulo}", ou troque para um link.`;
        }
      }
    }

    return null;
  }

  protected aoEnviar(): void {
    this.erroFormulario.set(null);

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.erroFormulario.set('Revise os campos destacados antes de continuar.');
      return;
    }

    const erroModulos = this.validarModulosLocalmente();
    if (erroModulos !== null) {
      this.erroFormulario.set(erroModulos);
      return;
    }

    this.enviando.set(true);
    const valores = this.formulario.getRawValue();

    const modulos: NovoModulo[] = this.modulos().map((modulo) => ({
      titulo: modulo.titulo,
      capitulos: modulo.capitulos.map((capitulo) => ({
        titulo: capitulo.titulo,
        tipoConteudo: capitulo.tipoConteudo,
        linkCapitulo: capitulo.tipoConteudo === 'LINK' ? capitulo.linkCapitulo : null,
        arquivo: capitulo.tipoConteudo === 'ARQUIVO' ? capitulo.arquivo : null,
        arquivoAtual: capitulo.tipoConteudo === 'ARQUIVO' ? capitulo.arquivoAtual : null
      }))
    }));

    const dados: NovoCurso = {
      titulo: valores.titulo,
      descricao: valores.descricao || null,
      cargaHoraria: valores.cargaHoraria,
      preco: valores.preco,
      modulos
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
        if (idEditando === null) {
          this.toastService.sucesso('Curso cadastrado com sucesso!');
        }
        this.aoCancelar();
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
