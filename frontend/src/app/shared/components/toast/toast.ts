import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ToastService } from '../../services/toast.service';

/** Host das mensagens flutuantes — montado uma única vez no componente raiz. */
@Component({
  selector: 'app-toast',
  templateUrl: './toast.html',
  styleUrl: './toast.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ToastHost {
  protected readonly toastService = inject(ToastService);
}
