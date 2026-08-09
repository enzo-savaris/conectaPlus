import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { onlyCnpjChars, onlyDigits } from '../utils/masks';

export function cnpjValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = onlyCnpjChars(control.value ?? '');

    if (!value) {
      return null; 
    }

    if (value.length !== 14) {
      return { cnpj: true };
    }

    if (!/^\d{2}$/.test(value.slice(12))) {
      return { cnpj: true };
    }

    if (/^(\w)\1{13}$/.test(value)) {
      return { cnpj: true };
    }

    const digit = (length: number): number => {
      let weight = length - 7;
      let sum = 0;

      for (let i = 0; i < length; i++) {
        sum += (value.charCodeAt(i) - 48) * weight--;
        if (weight < 2) {
          weight = 9;
        }
      }

      const rest = sum % 11;
      return rest < 2 ? 0 : 11 - rest;
    };

    const valid = digit(12) === Number(value[12]) && digit(13) === Number(value[13]);
    return valid ? null : { cnpj: true };
  };
}

export function cepValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = onlyDigits(control.value ?? '');
    if (!value) {
      return null;
    }
    return value.length === 8 ? null : { cep: true };
  };
}

export function phoneValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = onlyDigits(control.value ?? '');
    if (!value) {
      return null;
    }
    return value.length === 10 || value.length === 11 ? null : { phone: true };
  };
}
