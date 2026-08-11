import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { apenasCaracteresCnpj, apenasDigitos } from '../utils/masks';

export function validadorCnpj(): ValidatorFn {
  return (controle: AbstractControl): ValidationErrors | null => {
    const valor = apenasCaracteresCnpj(controle.value ?? '');

    if (!valor) {
      return null;
    }

    if (valor.length !== 14) {
      return { cnpj: true };
    }

    if (!/^\d{2}$/.test(valor.slice(12))) {
      return { cnpj: true };
    }

    if (/^(\w)\1{13}$/.test(valor)) {
      return { cnpj: true };
    }

    const digitoVerificador = (tamanho: number): number => {
      let peso = tamanho - 7;
      let soma = 0;

      for (let i = 0; i < tamanho; i++) {
        soma += (valor.charCodeAt(i) - 48) * peso--;
        if (peso < 2) {
          peso = 9;
        }
      }

      const resto = soma % 11;
      return resto < 2 ? 0 : 11 - resto;
    };

    const valido =
      digitoVerificador(12) === Number(valor[12]) && digitoVerificador(13) === Number(valor[13]);
    return valido ? null : { cnpj: true };
  };
}

export function validadorCep(): ValidatorFn {
  return (controle: AbstractControl): ValidationErrors | null => {
    const valor = apenasDigitos(controle.value ?? '');
    if (!valor) {
      return null;
    }
    return valor.length === 8 ? null : { cep: true };
  };
}

export function validadorTelefone(): ValidatorFn {
  return (controle: AbstractControl): ValidationErrors | null => {
    const valor = apenasDigitos(controle.value ?? '');
    if (!valor) {
      return null;
    }
    return valor.length === 10 || valor.length === 11 ? null : { telefone: true };
  };
}
