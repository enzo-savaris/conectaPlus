import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { URL_BASE_API } from '../config/api';
import { ModeloTrabalho, NovaVaga, StatusVaga, TipoContratacao, Vaga } from '../types/vaga';

/** Formato bruto devolvido pela API: colunas da TBLCDSVAG0. */
interface VagaDaApi {
  IDVAGA: number;
  IDEMPRESA: number;
  TITULO: string;
  AREA: string | null;
  DESCRICAO: string;
  CIDADE: string | null;
  ESTADO: string | null;
  MODELOTRABALHO: ModeloTrabalho;
  TIPOCONTRATACAO: TipoContratacao;
  // O mysql2 devolve colunas DECIMAL como string, para não perder precisão.
  SALARIOMIN: string | null;
  SALARIOMAX: string | null;
  DTCAD: string;
  STATUSVAGA: StatusVaga;
}

function paraVaga(vaga: VagaDaApi): Vaga {
  return {
    id: vaga.IDVAGA,
    idEmpresa: vaga.IDEMPRESA,
    titulo: vaga.TITULO,
    area: vaga.AREA,
    descricao: vaga.DESCRICAO,
    cidade: vaga.CIDADE,
    estado: vaga.ESTADO,
    modeloTrabalho: vaga.MODELOTRABALHO,
    tipoContratacao: vaga.TIPOCONTRATACAO,
    salarioMinimo: vaga.SALARIOMIN !== null ? Number(vaga.SALARIOMIN) : null,
    salarioMaximo: vaga.SALARIOMAX !== null ? Number(vaga.SALARIOMAX) : null,
    dataCadastro: vaga.DTCAD,
    status: vaga.STATUSVAGA
  };
}

@Injectable({ providedIn: 'root' })
export class VagaService {
  private readonly http = inject(HttpClient);

  /** Sem `idEmpresa`, lista as vagas de todas as empresas. */
  listar(idEmpresa?: number): Observable<Vaga[]> {
    const parametros =
      idEmpresa !== undefined ? new HttpParams().set('idEmpresa', idEmpresa) : undefined;

    return this.http
      .get<VagaDaApi[]>(`${URL_BASE_API}/vagas`, { params: parametros })
      .pipe(map((vagas) => vagas.map(paraVaga)));
  }

  cadastrar(dados: NovaVaga, idEmpresa: number): Observable<Vaga> {
    return this.http
      .post<VagaDaApi>(`${URL_BASE_API}/vagas`, { ...dados, idEmpresa })
      .pipe(map(paraVaga));
  }

  remover(id: number, idEmpresa: number): Observable<void> {
    const parametros = new HttpParams().set('idEmpresa', idEmpresa);
    return this.http.delete<void>(`${URL_BASE_API}/vagas/${id}`, { params: parametros });
  }
}
