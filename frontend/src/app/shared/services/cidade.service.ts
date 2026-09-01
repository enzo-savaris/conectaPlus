import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { URL_BASE_API } from '../config/api';
import { Cidade } from '../types/cidade';

/** Formato bruto devolvido pela API: colunas da TBLCDSCID0. */
interface CidadeDaApi {
  IDCIDADE: number;
  NOME: string;
  ESTADO: string;
}

function paraCidade(cidade: CidadeDaApi): Cidade {
  return { id: cidade.IDCIDADE, nome: cidade.NOME, estado: cidade.ESTADO };
}

@Injectable({ providedIn: 'root' })
export class CidadeService {
  private readonly http = inject(HttpClient);

  /** Busca cidades já cadastradas pelo nome, para o combobox do cadastro de vaga. */
  buscar(termo: string): Observable<Cidade[]> {
    const parametros = new HttpParams().set('busca', termo);

    return this.http
      .get<CidadeDaApi[]>(`${URL_BASE_API}/cidades`, { params: parametros })
      .pipe(map((cidades) => cidades.map(paraCidade)));
  }

  /** Resolve a cidade do CEP informado (via ViaCEP), cadastrando-a se ainda não existir. */
  buscarPorCep(cep: string): Observable<Cidade> {
    return this.http.get<CidadeDaApi>(`${URL_BASE_API}/cidades/cep/${cep}`).pipe(map(paraCidade));
  }
}
