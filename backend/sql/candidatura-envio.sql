-- Fluxo de envio da candidatura: além de só registrar a inscrição, o
-- candidato agora manda uma carta de apresentação, escolhe quais adaptações
-- de acessibilidade precisa no processo seletivo, responde às perguntas que a
-- empresa cadastrou na vaga e pode anexar um currículo em PDF só para esta
-- vaga (quando CURRICULOPDF fica NULL, vale o currículo do perfil).

USE `conecta+`;

ALTER TABLE TBLCDSCAND0
  ADD COLUMN CARTAAPRESENTACAO VARCHAR(500) NULL,
  ADD COLUMN CURRICULOPDF VARCHAR(255) NULL,
  ADD COLUMN ENTREVISTAREMOTA TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN TEMPOESTENDIDO TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN INTERPRETELIBRAS TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN INICIOIMEDIATO TINYINT(1) NOT NULL DEFAULT 0;

-- Perguntas que a empresa faz a quem se candidata, cadastradas junto com a
-- vaga — mesmo padrão das outras listas de item da vaga.
CREATE TABLE IF NOT EXISTS TBLCDSVAGPERG0 (
  IDPERG INT NOT NULL AUTO_INCREMENT,
  IDVAGA INT NOT NULL,
  DESCRICAO VARCHAR(255) NOT NULL,
  PRIMARY KEY (IDPERG),
  CONSTRAINT FK_VAGAPERG_VAGA FOREIGN KEY (IDVAGA) REFERENCES TBLCDSVAG0 (IDVAGA) ON DELETE CASCADE
);

-- Respostas do candidato. A pergunta é copiada como texto (em vez de só o
-- IDPERG) porque a empresa regrava a lista de perguntas inteira a cada edição
-- da vaga — sem a cópia, as respostas já enviadas perderiam o enunciado.
CREATE TABLE IF NOT EXISTS TBLCDSCANDRESP0 (
  IDRESPOSTA INT NOT NULL AUTO_INCREMENT,
  IDCANDIDATURA INT NOT NULL,
  PERGUNTA VARCHAR(255) NOT NULL,
  RESPOSTA TEXT NOT NULL,
  PRIMARY KEY (IDRESPOSTA),
  CONSTRAINT FK_CANDRESP_CANDIDATURA FOREIGN KEY (IDCANDIDATURA) REFERENCES TBLCDSCAND0 (IDCANDIDATURA) ON DELETE CASCADE
);
