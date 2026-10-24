-- 1) Processo seletivo completo entre a entrevista e a contratação:
--    ENTREVISTA -> ENTREVISTA_REALIZADA (a empresa registra como foi)
--               -> PROPOSTA (salário, início, condições)
--               -> APROVADO (o candidato aceitou: contratado)
--                  ou DESISTIU (o candidato recusou a proposta).
-- 2) Conclusão de curso: o aluno marca que terminou.

USE `conecta+`;

ALTER TABLE TBLCDSCAND0
  MODIFY COLUMN STATUSCANDIDATURA
    ENUM('PENDENTE','EM_ANALISE','ENTREVISTA','ENTREVISTA_REALIZADA','PROPOSTA','APROVADO','REPROVADO','DESISTIU')
    DEFAULT 'PENDENTE',
  -- Anotações da empresa sobre a entrevista. Internas: o candidato não vê.
  ADD COLUMN NOTASENTREVISTA TEXT NULL,
  ADD COLUMN COMPARECEU TINYINT(1) NULL,
  -- Proposta de contratação (DTINICIO, já existente, guarda a data de início proposta).
  ADD COLUMN PROPOSTASALARIO DECIMAL(10,2) NULL,
  ADD COLUMN PROPOSTADETALHES TEXT NULL,
  ADD COLUMN PROPOSTAVALIDADE DATE NULL,
  -- Resposta do candidato à proposta (motivo, quando recusa).
  ADD COLUMN RESPOSTACANDIDATO TEXT NULL,
  ADD COLUMN DTRESPOSTA DATETIME NULL;

ALTER TABLE TBLCDSCANDHIST0
  MODIFY COLUMN STATUSCANDIDATURA
    ENUM('PENDENTE','EM_ANALISE','ENTREVISTA','ENTREVISTA_REALIZADA','PROPOSTA','APROVADO','REPROVADO','DESISTIU')
    NOT NULL;

ALTER TABLE TBLCDSMATR0
  ADD COLUMN DTCONCLUSAO DATETIME NULL;
