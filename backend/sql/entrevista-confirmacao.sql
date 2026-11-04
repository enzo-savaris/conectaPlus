-- O candidato confirma pela plataforma que vai comparecer à entrevista
-- agendada pela empresa. NULL = ainda não confirmou. Reagendar a entrevista
-- volta para NULL, porque a confirmação valia para a data antiga.

USE `conecta+`;

ALTER TABLE tblcdscand0
  ADD COLUMN DTCONFIRMACAOENTREVISTA DATETIME NULL AFTER OBSENTREVISTA;
