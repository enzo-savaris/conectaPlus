export type TipoDeficiencia = 'FISICA' | 'AUDITIVA' | 'VISUAL' | 'INTELECTUAL' | 'MULTIPLA' | 'OUTRA';

/** Candidato PCD já inscrito em alguma vaga da empresa, exibido na tela de Candidatos. */
export interface CandidatoRelacionado {
  id: number;
  nome: string;
  email: string | null;
  telefone: string | null;
  sobreMim: string | null;
  tipoDeficiencia: TipoDeficiencia;
  cidade: string | null;
  estado: string | null;
}
