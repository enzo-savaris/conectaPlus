-- O e-mail deixou de ser único entre empresas: é comum o mesmo contador/RH
-- cuidar do cadastro de mais de uma empresa com o mesmo e-mail de contato.
-- Só o CNPJ continua sendo a chave que identifica a empresa.
ALTER TABLE TBLCDSEMP0 DROP INDEX EMAIL;
