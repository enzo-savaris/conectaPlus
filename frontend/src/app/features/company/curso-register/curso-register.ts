import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../../../shared/services/auth.service';
import { CursoService } from '../../../shared/services/curso.service';
import { ToastService } from '../../../shared/services/toast.service';
import { NovoCurso, NovoModulo, TipoConteudoCurso } from '../../../shared/types/curso';

const REGEX_URL = /^https?:\/\/.+/i;

/** Estado de edição de uma aula: espelha `NovoCapitulo`, mas com string vazia em vez de null nos campos de texto (mais fácil de ligar ao input). */
interface CapituloEmEdicao {
  titulo: string;
  descricao: string;
  tipoConteudo: TipoConteudoCurso;
  linkCapitulo: string;
  arquivo: File | null;
  /** Nome do vídeo já cadastrado (edição) e sua URL só para exibir o nome ao usuário. */
  arquivoAtual: string | null;
  arquivoAtualNome: string | null;
  material: File | null;
  /** Nome do material já cadastrado (edição) e seu nome só para exibir ao usuário. */
  materialAtual: string | null;
  materialAtualNome: string | null;
}

interface ModuloEmEdicao {
  titulo: string;
  capitulos: CapituloEmEdicao[];
}

function criarCapituloVazio(): CapituloEmEdicao {
  return {
    titulo: '',
    descricao: '',
    tipoConteudo: 'LINK',
    linkCapitulo: '',
    arquivo: null,
    arquivoAtual: null,
    arquivoAtualNome: null,
    material: null,
    materialAtual: null,
    materialAtualNome: null
  };
}

function criarModuloVazio(): ModuloEmEdicao {
  return { titulo: '', capitulos: [criarCapituloVazio()] };
}

/** Extrai o nome do arquivo a partir da URL pronta que a API devolve (.../uploads/cursos/<nome>). */
function nomeArquivoDaUrl(url: string): string {
  return url.split('/').pop() ?? url;
}

/** Tela de cadastro/edição de curso da empresa: dados básicos, mais módulos e aulas. */
@Component({
  selector: 'app-curso-register',
  imports: [ReactiveFormsModule],
  templateUrl: './curso-register.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CursoRegister {
  private readonly roteador = inject(Router);
  private readonly rota = inject(ActivatedRoute);
  private readonly cursoService = inject(CursoService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);

  /** Presente só na rota de edição (`empresa/cursos/:id/editar`). */
  protected readonly idCursoEditando = signal<number | null>(null);
  protected readonly carregandoCurso = signal(false);
  protected readonly enviando = signal(false);
  protected readonly erroFormulario = signal<string | null>(null);

  protected readonly modulos = signal<ModuloEmEdicao[]>([criarModuloVazio()]);

  /**
   * Só empresa ATIVA pode cadastrar/editar cursos; PENDENTE (ex.: depois de
   * mudar CNPJ/razão social) ou INATIVA só pode visualizar os já cadastrados.
   */
  protected readonly empresaAtiva = computed(() => {
    const sessao = this.authService.sessao();
    return sessao?.ambiente !== 'empresa' || sessao.perfil.status === 'ATIVA';
  });

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
    if (!this.empresaAtiva()) {
      // Empresa PENDENTE/INATIVA não deve cair aqui nem digitando a URL direto:
      // sem isso, o botão fica escondido na lista, mas a rota continuaria acessível.
      this.roteador.navigate(['/cursos']);
      return;
    }

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

    const idParam = this.rota.snapshot.paramMap.get('id');
    if (idParam) {
      const idCurso = Number(idParam);
      this.idCursoEditando.set(idCurso);
      this.carregarCursoParaEdicao(idCurso);
    }
  }

  /** Garantido pelo ambienteGuard('empresa'): só entra aqui quem está logado como empresa. */
  private idEmpresaLogada(): number {
    const sessao = this.authService.sessao();
    return sessao?.ambiente === 'empresa' ? sessao.perfil.id : 0;
  }

  private carregarCursoParaEdicao(idCurso: number): void {
    this.carregandoCurso.set(true);
    this.erroFormulario.set(null);

    this.cursoService.obterPorId(idCurso).subscribe({
      next: (detalhado) => {
        this.carregandoCurso.set(false);

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
              descricao: capitulo.descricao ?? '',
              tipoConteudo: capitulo.tipoConteudo,
              linkCapitulo: capitulo.linkCapitulo ?? '',
              arquivo: null,
              arquivoAtual: capitulo.arquivoCapituloUrl ? nomeArquivoDaUrl(capitulo.arquivoCapituloUrl) : null,
              arquivoAtualNome: capitulo.arquivoCapituloUrl ? nomeArquivoDaUrl(capitulo.arquivoCapituloUrl) : null,
              material: null,
              materialAtual: capitulo.materialUrl ? nomeArquivoDaUrl(capitulo.materialUrl) : null,
              materialAtualNome: capitulo.materialUrl ? nomeArquivoDaUrl(capitulo.materialUrl) : null
            }))
          }))
        );
      },
      error: () => {
        this.carregandoCurso.set(false);
        this.erroFormulario.set('Não foi possível carregar esse curso para edição.');
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

  protected atualizarDescricaoCapitulo(indiceModulo: number, indiceCapitulo: number, valor: string): void {
    this.atualizarCapitulo(indiceModulo, indiceCapitulo, { descricao: valor });
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

  /** Material de apoio é opcional e independe do tipo de conteúdo (link ou vídeo) da aula. */
  protected selecionarMaterialCapitulo(indiceModulo: number, indiceCapitulo: number, evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    this.atualizarCapitulo(indiceModulo, indiceCapitulo, { material: entrada.files?.[0] ?? null });
  }

  /** Falta um vídeo nessa aula: nem veio um novo, nem já havia um cadastrado (edição). */
  protected precisaDeArquivoNovo(capitulo: CapituloEmEdicao): boolean {
    return capitulo.tipoConteudo === 'ARQUIVO' && capitulo.arquivo === null && capitulo.arquivoAtual === null;
  }

  // ============ ENVIO ============

  protected aoCancelar(): void {
    this.roteador.navigate(['/cursos']);
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
        descricao: capitulo.descricao.trim() || null,
        tipoConteudo: capitulo.tipoConteudo,
        linkCapitulo: capitulo.tipoConteudo === 'LINK' ? capitulo.linkCapitulo : null,
        arquivo: capitulo.tipoConteudo === 'ARQUIVO' ? capitulo.arquivo : null,
        arquivoAtual: capitulo.tipoConteudo === 'ARQUIVO' ? capitulo.arquivoAtual : null,
        material: capitulo.material,
        materialAtual: capitulo.materialAtual
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
      next: () => {
        this.enviando.set(false);
        if (idEditando === null) {
          this.toastService.sucesso('Curso cadastrado com sucesso!');
        }
        this.roteador.navigate(['/cursos']);
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
}
