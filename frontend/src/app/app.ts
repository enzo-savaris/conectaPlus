import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ToastHost } from './shared/components/toast/toast';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastHost],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('conectaPlus');
}
