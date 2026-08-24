import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Painel de marca compartilhado pelas telas públicas de autenticação (login, cadastro).
 *
 * `host: { class: 'contents' }` faz o próprio elemento <app-brand-panel> "desaparecer"
 * do layout (display: contents) — sem isso, ele ficaria inline por padrão e o
 * w-1/2 do <section> interno não teria efeito no flex do <main> que o envolve.
 */
@Component({
  selector: 'app-brand-panel',
  templateUrl: './brand-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' }
})
export class BrandPanel {}
