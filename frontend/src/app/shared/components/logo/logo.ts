import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Logo do Conecta+: o símbolo (public/logo-conectaplus.svg) e, opcionalmente,
 * o nome "CONECTA +" ao lado. Centralizado aqui para que trocar a logo no
 * futuro seja mexer num lugar só.
 *
 * Com o nome visível, o símbolo é decorativo (alt vazio), porque o leitor de
 * tela já lê o texto. Sem o nome, o próprio símbolo é anunciado como "Conecta+".
 */
@Component({
  selector: 'app-logo',
  template: `
    <span class="inline-flex items-center" [class]="mostrarNome() ? 'gap-2' : ''">
      <img
        src="logo-conectaplus.svg"
        [alt]="mostrarNome() ? '' : 'Conecta+'"
        [class]="classeSimbolo()"
        class="shrink-0 select-none"
        draggable="false"
      />
      @if (mostrarNome()) {
        <span class="font-extrabold tracking-tight text-white" [class]="classeNome()">
          CONECTA <span class="text-brand-300">+</span>
        </span>
      }
    </span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Logo {
  /** Mostra o texto "CONECTA +" ao lado do símbolo. */
  readonly mostrarNome = input(true);
  /** Tamanho do símbolo (classes Tailwind). */
  readonly classeSimbolo = input('size-7');
  /** Tamanho do texto (classes Tailwind). */
  readonly classeNome = input('text-lg');
}
