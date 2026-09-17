import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { URL_BASE_API } from '../config/api';
import {
  AtualizarPerfilCandidato,
  NovoCandidato,
  PerfilCandidato,
  TipoCurriculo,
  TipoDeficiencia
} from '../types/candidato';

/** Formato bruto devolvido pela API ao cadastrar: colunas da TBLCDSUSR0. */
interface UsuarioCadastradoDaApi {
  IDPCD: number;
}

interface ExperienciaDaApi {
  IDEXPERIENCIA: number;
  CARGO: string;
  EMPRESA: string;
  PERIODO: string | null;
  DESCRICAO: string | null;
}

interface FormacaoDaApi {
  IDFORMACAO: number;
  CURSO: string;
  INSTITUICAO: string;
  PERIODO: string | null;
}

/** Formato bruto devolvido por GET /usuarios/:id: colunas da TBLCDSUSR0 + as listas do currículo. */
interface PerfilCandidatoDaApi {
  IDPCD: number;
  NOME: string;
  EMAIL: string | null;
  TELEFONE: string | null;
  CPF: string;
  SOBREMIM: string | null;
  TIPODEF: TipoDeficiencia;
  CIDADE: string | null;
  ESTADO: string | null;
  AVATAR: string | null;
  TITULOPROFISSIONAL: string | null;
  TIPOCURRICULO: TipoCurriculo;
  CURRICULOPDF: string | null;
  DTCAD: string;
  STATUSPCD: string;
  recursos: string[];
  interesses: string[];
  habilidades: string[];
  experiencias: ExperienciaDaApi[];
  formacoes: FormacaoDaApi[];
}

function paraPerfilCandidato(perfil: PerfilCandidatoDaApi): PerfilCandidato {
  return {
    id: perfil.IDPCD,
    nome: perfil.NOME,
    email: perfil.EMAIL,
    telefone: perfil.TELEFONE,
    cpf: perfil.CPF,
    sobreMim: perfil.SOBREMIM,
    tituloProfissional: perfil.TITULOPROFISSIONAL,
    tipoDeficiencia: perfil.TIPODEF,
    cidade: perfil.CIDADE,
    estado: perfil.ESTADO,
    avatarUrl: perfil.AVATAR ? `${URL_BASE_API}/uploads/avatares/${perfil.AVATAR}` : null,
    tipoCurriculo: perfil.TIPOCURRICULO,
    curriculoPdfUrl: perfil.CURRICULOPDF ? `${URL_BASE_API}/uploads/curriculos/${perfil.CURRICULOPDF}` : null,
    recursos: perfil.recursos,
    interesses: perfil.interesses,
    habilidades: perfil.habilidades,
    experiencias: perfil.experiencias.map((exp) => ({
      id: exp.IDEXPERIENCIA,
      cargo: exp.CARGO,
      empresa: exp.EMPRESA,
      periodo: exp.PERIODO,
      descricao: exp.DESCRICAO
    })),
    formacoes: perfil.formacoes.map((form) => ({
      id: form.IDFORMACAO,
      curso: form.CURSO,
      instituicao: form.INSTITUICAO,
      periodo: form.PERIODO
    })),
    dataCadastro: perfil.DTCAD,
    status: perfil.STATUSPCD
  };
}

/** Monta o multipart/form-data: a foto de perfil só viaja assim, então usamos o mesmo formato pra tudo. */
function paraFormData(dados: NovoCandidato): FormData {
  const formData = new FormData();

  formData.append('nome', dados.nome);
  formData.append('email', dados.email);
  formData.append('telefone', dados.telefone);
  formData.append('cpf', dados.cpf);
  formData.append('senha', dados.senha);
  formData.append('tipoDeficiencia', dados.tipoDeficiencia);
  formData.append('recursos', JSON.stringify(dados.recursos));
  formData.append('interesses', JSON.stringify(dados.interesses));

  if (dados.avatar) {
    formData.append('avatar', dados.avatar);
  }

  return formData;
}

/** Monta o multipart/form-data da edição de perfil: só os campos informados entram no corpo. */
function paraFormDataPerfil(dados: AtualizarPerfilCandidato): FormData {
  const formData = new FormData();

  const camposTexto: (keyof AtualizarPerfilCandidato)[] = [
    'nome',
    'email',
    'telefone',
    'senha',
    'tituloProfissional',
    'sobreMim',
    'cidade',
    'estado',
    'tipoDeficiencia',
    'tipoCurriculo'
  ];

  for (const campo of camposTexto) {
    const valor = dados[campo];
    if (valor !== undefined) {
      formData.append(campo, valor === null ? '' : String(valor));
    }
  }

  const camposLista: (keyof AtualizarPerfilCandidato)[] = ['recursos', 'interesses', 'habilidades', 'experiencias', 'formacoes'];
  for (const campo of camposLista) {
    const valor = dados[campo];
    if (valor !== undefined) {
      formData.append(campo, JSON.stringify(valor));
    }
  }

  if (dados.avatar) {
    formData.append('avatar', dados.avatar);
  }
  if (dados.curriculoPdf) {
    formData.append('curriculoPdf', dados.curriculoPdf);
  }

  return formData;
}

@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private readonly http = inject(HttpClient);

  /** Cadastra o candidato PCD; a conta já nasce ATIVA, sem aprovação manual. */
  cadastrar(dados: NovoCandidato): Observable<number> {
    return this.http
      .post<UsuarioCadastradoDaApi>(`${URL_BASE_API}/usuarios`, paraFormData(dados))
      .pipe(map((usuario) => usuario.IDPCD));
  }

  /**
   * Busca o perfil completo do candidato. Sem `idEmpresa`, é o próprio
   * candidato vendo/editando o perfil. Com `idEmpresa`, é a empresa abrindo
   * o perfil de alguém inscrito numa vaga dela — a API confere isso.
   */
  obterPorId(id: number, idEmpresa?: number): Observable<PerfilCandidato> {
    const parametros = idEmpresa !== undefined ? new HttpParams().set('idEmpresa', idEmpresa) : undefined;

    return this.http
      .get<PerfilCandidatoDaApi>(`${URL_BASE_API}/usuarios/${id}`, { params: parametros })
      .pipe(map(paraPerfilCandidato));
  }

  /** Atualiza o perfil do candidato; só os campos informados em `dados` são alterados. */
  atualizar(id: number, dados: AtualizarPerfilCandidato): Observable<PerfilCandidato> {
    return this.http
      .put<PerfilCandidatoDaApi>(`${URL_BASE_API}/usuarios/${id}`, paraFormDataPerfil(dados))
      .pipe(map(paraPerfilCandidato));
  }
}
