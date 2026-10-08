import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { AuthService } from '../../../shared/services/auth.service';
import { ToastService } from '../../../shared/services/toast.service';
import { UsuarioService } from '../../../shared/services/usuario.service';
import { VagaService } from '../../../shared/services/vaga.service';
import { PerfilCandidato } from '../../../shared/types/candidato';
import { AdaptacoesCandidatura, VagaDetalhada } from '../../../shared/types/vaga';

/** Mesmo limite da coluna CARTAAPRESENTACAO (VARCHAR(500)). */
const LIMITE_CARTA = 500;

/** Mesmo limite do multer no backend (uploadCurriculoCandidatura). */
const TAMANHO_MAXIMO_PDF = 10 * 1024 * 1024;

/**
 * Tela "Candidatar-se": o candidato PCD confirma o currículo (o do perfil ou
 * um PDF só para esta vaga), escreve uma carta de apresentação, escolhe as
 * adaptações de acessibilidade que precisa no processo seletivo e responde às
 * perguntas que a empresa cadastrou na vaga. A etapa de "Identificação" já
 * vem concluída porque só candidato logado chega aqui.
 */
@Component({
  selector: 'app-candidatura',
  imports: [RouterLink],
  templateUrl: './candidatura.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Candidatura {
  private readonly rota = inject(ActivatedRoute);
  private readonly roteador = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly usuarioService = inject(UsuarioService);
  private readonly vagaService = inject(VagaService);
  private readonly toastService = inject(ToastService);

  protected readonly limiteCarta = LIMITE_CARTA;

  private readonly idVaga = Number(this.rota.snapshot.paramMap.get('id'));

  protected readonly vaga = signal<VagaDetalhada | null>(null);
  protected readonly perfil = signal<PerfilCandidato | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);
  protected readonly enviando = signal(false);
  protected readonly erroEnvio = signal<string | null>(null);

  protected readonly carta = signal('');
  protected readonly curriculoPdf = signal<File | null>(null);
  protected readonly erroCurriculo = signal<string | null>(null);
  protected readonly aceiteTermos = signal(false);
  protected readonly inicioImediato = signal(false);
  protected readonly tentouEnviar = signal(false);
  protected readonly adaptacoes = signal<AdaptacoesCandidatura>({
    entrevistaRemota: false,
    tempoEstendido: false,
    interpreteLibras: false
  });
  /** Uma resposta por pergunta da vaga, na mesma ordem. */
  protected readonly respostas = signal<string[]>([]);

  protected readonly opcoesAdaptacao: { chave: keyof AdaptacoesCandidatura; rotulo: string }[] = [
    { chave: 'entrevistaRemota', rotulo: 'Entrevista 100% remota' },
    { chave: 'tempoEstendido', rotulo: 'Tempo estendido em testes' },
    { chave: 'interpreteLibras', rotulo: 'Intérprete de Libras' }
  ];

  /** O PDF do perfil só vale quando o candidato escolheu esse tipo de currículo e de fato enviou o arquivo. */
  protected readonly curriculoPdfDoPerfil = computed(() => {
    const perfil = this.perfil();
    return perfil?.tipoCurriculo === 'PDF' ? perfil.curriculoPdfUrl : null;
  });

  constructor() {
    this.carregar();
  }

  private idCandidatoLogado(): number {
    const sessao = this.authService.sessao();
    // A rota é protegida pelo ambienteGuard('usuario'), então a sessão sempre existe aqui.
    return sessao?.ambiente === 'usuario' ? sessao.perfil.id : 0;
  }

  private carregar(): void {
    const idPcd = this.idCandidatoLogado();

    // Quem já se candidatou (ex.: voltou pelo histórico do navegador) vai
    // direto para o acompanhamento, em vez de ver o formulário de novo.
    this.vagaService.obterMinhaCandidatura(idPcd, this.idVaga).subscribe({
      next: () => this.irParaAcompanhamento(),
      error: () => this.carregarFormulario(idPcd)
    });
  }

  private carregarFormulario(idPcd: number): void {
    forkJoin({
      vaga: this.vagaService.obterPorId(this.idVaga),
      perfil: this.usuarioService.obterPorId(idPcd)
    }).subscribe({
      next: ({ vaga, perfil }) => {
        if (vaga.status !== 'ATIVA') {
          this.erro.set('Esta vaga não está mais recebendo candidaturas.');
          this.carregando.set(false);
          return;
        }

        this.vaga.set(vaga);
        this.perfil.set(perfil);
        this.respostas.set(vaga.perguntas.map(() => ''));
        this.adaptacoes.set(this.adaptacoesSugeridas(perfil));
        this.carregando.set(false);
      },
      error: () => {
        this.erro.set('Não foi possível carregar essa vaga. Ela pode ter sido removida ou encerrada.');
        this.carregando.set(false);
      }
    });
  }

  /**
   * Já deixa ligadas as adaptações que combinam com os recursos de
   * acessibilidade que o candidato marcou no perfil — ele ainda pode desligar.
   */
  private adaptacoesSugeridas(perfil: PerfilCandidato): AdaptacoesCandidatura {
    const recursos = perfil.recursos.join(' ').toLowerCase();

    return {
      entrevistaRemota: /remot/.test(recursos),
      tempoEstendido: /tempo/.test(recursos),
      interpreteLibras: /libras|int[ée]rprete/.test(recursos)
    };
  }

  protected alternarAdaptacao(chave: keyof AdaptacoesCandidatura): void {
    this.adaptacoes.update((atual) => ({ ...atual, [chave]: !atual[chave] }));
  }

  protected aoDigitarCarta(evento: Event): void {
    this.carta.set((evento.target as HTMLTextAreaElement).value);
  }

  protected aoDigitarResposta(indice: number, evento: Event): void {
    const valor = (evento.target as HTMLTextAreaElement).value;
    this.respostas.update((lista) => lista.map((resposta, i) => (i === indice ? valor : resposta)));
  }

  protected aoMarcarTermos(evento: Event): void {
    this.aceiteTermos.set((evento.target as HTMLInputElement).checked);
  }

  protected aoMarcarInicioImediato(evento: Event): void {
    this.inicioImediato.set((evento.target as HTMLInputElement).checked);
  }

  protected aoEscolherCurriculo(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const arquivo = entrada.files?.[0] ?? null;
    // Limpa o input pra permitir escolher o mesmo arquivo de novo depois de remover.
    entrada.value = '';

    if (!arquivo) {
      return;
    }

    if (arquivo.type !== 'application/pdf') {
      this.erroCurriculo.set('O currículo precisa ser um arquivo PDF.');
      return;
    }

    if (arquivo.size > TAMANHO_MAXIMO_PDF) {
      this.erroCurriculo.set('O PDF deve ter no máximo 10 MB.');
      return;
    }

    this.erroCurriculo.set(null);
    this.curriculoPdf.set(arquivo);
  }

  protected removerCurriculoAnexado(): void {
    this.curriculoPdf.set(null);
  }

  protected formatarTamanho(bytes: number): string {
    if (bytes < 1024 * 1024) {
      return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  }

  protected enviar(): void {
    const vaga = this.vaga();
    if (!vaga) {
      return;
    }

    this.tentouEnviar.set(true);
    this.erroEnvio.set(null);

    if (!this.aceiteTermos()) {
      this.erroEnvio.set('Para enviar, confirme que concorda com os termos e requisitos da vaga.');
      return;
    }

    this.enviando.set(true);

    const dados = {
      cartaApresentacao: this.carta().trim(),
      adaptacoes: this.adaptacoes(),
      aceiteTermos: this.aceiteTermos(),
      inicioImediato: this.inicioImediato(),
      respostas: vaga.perguntas.map((pergunta, i) => ({ pergunta, resposta: this.respostas()[i]?.trim() ?? '' })),
      curriculoPdf: this.curriculoPdf()
    };

    this.vagaService.candidatar(vaga.id, this.idCandidatoLogado(), dados).subscribe({
      next: () => {
        this.enviando.set(false);
        this.toastService.sucesso('Candidatura enviada com sucesso!');
        this.irParaAcompanhamento();
      },
      error: (erro: HttpErrorResponse) => {
        this.enviando.set(false);

        if (erro.status === 409) {
          // Já tinha se candidatado antes (ex.: outra aba); só mostra o acompanhamento.
          this.irParaAcompanhamento();
          return;
        }

        const mensagem = (erro.error as { mensagem?: string; erros?: Record<string, string> } | null);
        const primeiroErro = mensagem?.erros ? Object.values(mensagem.erros)[0] : undefined;
        this.erroEnvio.set(
          primeiroErro ?? mensagem?.mensagem ?? 'Não foi possível enviar sua candidatura. Tente novamente.'
        );
      }
    });
  }

  private irParaAcompanhamento(): void {
    this.roteador.navigate(['/vagas-disponiveis', this.idVaga, 'candidatura'], { replaceUrl: true });
  }
}
