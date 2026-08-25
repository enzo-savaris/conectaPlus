-- Guarda a data da última alteração do cadastro da empresa, usada na tela
-- de perfil ("Última edição: ..."). Atualizada automaticamente pelo MySQL a
-- cada UPDATE em TBLCDSEMP0 — não precisa ser gravada manualmente pela API.
ALTER TABLE TBLCDSEMP0
  ADD COLUMN DTALT DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
