import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { URL_BASE_API } from '../config/api';
import { ResumoPainelEmpresa } from '../types/painel-empresa';

/** Formato bruto devolvido pela API: GET /empresas/:id/painel. */
interface ResumoPainelEmpresaDaApi {
  totalVagas: number;
  totalCursos: number;
  totalInscricoes: number;
}

function paraResumo(resumo: ResumoPainelEmpresaDaApi): ResumoPainelEmpresa {
  return {
    totalVagas: resumo.totalVagas,
    totalCursos: resumo.totalCursos,
    totalInscricoes: resumo.totalInscricoes
  };
}

@Injectable({ providedIn: 'root' })
export class PainelEmpresaService {
  private readonly http = inject(HttpClient);

  obterResumo(idEmpresa: number): Observable<ResumoPainelEmpresa> {
    return this.http
      .get<ResumoPainelEmpresaDaApi>(`${URL_BASE_API}/empresas/${idEmpresa}/painel`)
      .pipe(map(paraResumo));
  }
}
