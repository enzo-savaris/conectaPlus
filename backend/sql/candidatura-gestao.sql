-- Gestão da candidatura pela empresa: o processo seletivo passa a ter uma
-- etapa de entrevista (agendada pela própria plataforma) e termina com a
-- contratação (APROVADO) ou o encerramento (REPROVADO). O candidato
-- acompanha cada etapa na tela de acompanhamento da candidatura.

USE `conecta+`;

ALTER TABLE TBLCDSCAND0
  MODIFY COLUMN STATUSCANDIDATURA
    ENUM('PENDENTE','EM_ANALISE','ENTREVISTA','APROVADO','REPROVADO') DEFAULT 'PENDENTE',
  ADD COLUMN DTENTREVISTA DATETIME NULL,
  ADD COLUMN FORMATOENTREVISTA ENUM('REMOTA','PRESENCIAL') NULL,
  -- Link da chamada (REMOTA) ou endereço (PRESENCIAL).
  ADD COLUMN LOCALENTREVISTA VARCHAR(500) NULL,
  ADD COLUMN OBSENTREVISTA TEXT NULL,
  -- Data prevista de início, informada ao contratar.
  ADD COLUMN DTINICIO DATE NULL,
  -- Mensagem da empresa ao candidato no resultado final (contratação ou retorno).
  ADD COLUMN MENSAGEMEMPRESA TEXT NULL;

-- Uma linha por mudança de etapa: dá a data/hora de cada passo na linha do
-- tempo que o candidato vê ("Hoje, 14:32").
CREATE TABLE IF NOT EXISTS TBLCDSCANDHIST0 (
  IDHISTORICO INT NOT NULL AUTO_INCREMENT,
  IDCANDIDATURA INT NOT NULL,
  STATUSCANDIDATURA ENUM('PENDENTE','EM_ANALISE','ENTREVISTA','APROVADO','REPROVADO') NOT NULL,
  DTCAD DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (IDHISTORICO),
  CONSTRAINT FK_CANDHIST_CANDIDATURA FOREIGN KEY (IDCANDIDATURA) REFERENCES TBLCDSCAND0 (IDCANDIDATURA) ON DELETE CASCADE
);

-- Candidaturas que já existiam ganham o registro de quando foram recebidas.
INSERT INTO TBLCDSCANDHIST0 (IDCANDIDATURA, STATUSCANDIDATURA, DTCAD)
  SELECT c.IDCANDIDATURA, 'PENDENTE', c.DTCAD
  FROM TBLCDSCAND0 c
  WHERE NOT EXISTS (SELECT 1 FROM TBLCDSCANDHIST0 h WHERE h.IDCANDIDATURA = c.IDCANDIDATURA);
