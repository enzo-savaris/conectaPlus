-- O candidato avisa pela plataforma que não consegue comparecer na data da
-- entrevista e pede que a empresa reagende. A etapa continua ENTREVISTA:
-- só registra quando pediu e a mensagem dele (motivo, horários livres).
-- Reagendar a entrevista limpa o pedido.

USE `conecta+`;

ALTER TABLE tblcdscand0
  ADD COLUMN DTPEDIDOREAGENDAMENTO DATETIME NULL AFTER DTCONFIRMACAOENTREVISTA,
  ADD COLUMN MOTIVOREAGENDAMENTO TEXT NULL AFTER DTPEDIDOREAGENDAMENTO;
