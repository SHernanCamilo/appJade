import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { Variable, ValidationResult, ValidationError, ApiResponse } from '../interfaces/template.interface';
import Handlebars from 'handlebars';

@Injectable({
  providedIn: 'root'
})
export class VariableService {
  private apiUrl = '/variables';
  private variablesCache = new BehaviorSubject<Variable[]>([]);
  private cacheLoaded = false;

  public variables$ = this.variablesCache.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Obtener catálogo de variables disponibles
   */
  getAvailableVariables(forceRefresh: boolean = false): Observable<Variable[]> {
    if (!forceRefresh && this.cacheLoaded) {
      return this.variables$;
    }

    return this.http.get<ApiResponse<Variable[]>>(this.apiUrl).pipe(
      map(response => response.data || []),
      tap(variables => {
        this.variablesCache.next(variables);
        this.cacheLoaded = true;
      })
    );
  }

  /**
   * Extraer variables de un contenido de plantilla
   * Busca patrones {{nombre_variable}}
   */
  extractVariablesFromTemplate(content: string): string[] {
    const pattern = /\{\{([a-zA-Z0-9_]+)\}\}/g;
    const matches: string[] = [];
    let match;

    while ((match = pattern.exec(content)) !== null) {
      matches.push(match[1]);
    }

    // Retornar variables únicas
    return [...new Set(matches)];
  }

  /**
   * Reemplazar variables en una plantilla usando Handlebars
   */
  replaceVariables(template: string, values: Record<string, any>): string {
    try {
      const compiledTemplate = Handlebars.compile(template);
      return compiledTemplate(values);
    } catch (error) {
      console.error('Error al reemplazar variables:', error);
      throw new Error('Error al procesar la plantilla');
    }
  }

  /**
   * Validar el valor de una variable según su tipo
   */
  validateVariableValue(variable: Variable, value: any): ValidationResult {
    const errors: ValidationError[] = [];

    // Validar campo requerido
    if (variable.required && (value === null || value === undefined || value === '')) {
      errors.push({
        field: variable.name,
        message: `El campo ${variable.displayName} es obligatorio`,
        code: 'REQUIRED_FIELD'
      });
      return { valid: false, errors };
    }

    // Si no es requerido y está vacío, es válido
    if (!variable.required && (value === null || value === undefined || value === '')) {
      return { valid: true, errors: [] };
    }

    // Validar según tipo
    switch (variable.type) {
      case 'email':
        if (!this.isValidEmail(value)) {
          errors.push({
            field: variable.name,
            message: `El campo ${variable.displayName} debe ser un email válido`,
            code: 'INVALID_EMAIL'
          });
        }
        break;

      case 'phone':
        if (!this.isValidPhone(value)) {
          errors.push({
            field: variable.name,
            message: `El campo ${variable.displayName} debe ser un teléfono válido`,
            code: 'INVALID_PHONE'
          });
        }
        break;

      case 'date':
        if (!this.isValidDate(value)) {
          errors.push({
            field: variable.name,
            message: `El campo ${variable.displayName} debe ser una fecha válida`,
            code: 'INVALID_DATE'
          });
        }
        break;

      case 'number':
        if (isNaN(Number(value))) {
          errors.push({
            field: variable.name,
            message: `El campo ${variable.displayName} debe ser un número válido`,
            code: 'INVALID_NUMBER'
          });
        }
        break;

      case 'string':
        // String siempre es válido si no está vacío
        break;
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validar múltiples valores de variables
   */
  validateAllValues(variables: Variable[], values: Record<string, any>): ValidationResult {
    const allErrors: ValidationError[] = [];

    variables.forEach(variable => {
      const value = values[variable.name];
      const result = this.validateVariableValue(variable, value);
      
      if (!result.valid) {
        allErrors.push(...result.errors);
      }
    });

    return {
      valid: allErrors.length === 0,
      errors: allErrors
    };
  }

  /**
   * Validar formato de email
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validar formato de teléfono
   */
  private isValidPhone(phone: string): boolean {
    // Acepta formatos: +57 300 1234567, 300-123-4567, (300) 123-4567, 3001234567
    const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
    return phoneRegex.test(phone);
  }

  /**
   * Validar formato de fecha
   */
  private isValidDate(date: any): boolean {
    if (date instanceof Date) {
      return !isNaN(date.getTime());
    }
    
    const parsedDate = new Date(date);
    return !isNaN(parsedDate.getTime());
  }

  /**
   * Formatear fecha para mostrar
   */
  formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(d.getTime())) {
      return '';
    }

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  }

  /**
   * Obtener variables del cache (síncrono)
   */
  get cachedVariables(): Variable[] {
    return this.variablesCache.value;
  }

  /**
   * Verificar si una variable existe en el catálogo
   */
  isVariableInCatalog(variableName: string): boolean {
    return this.cachedVariables.some(v => v.name === variableName);
  }

  /**
   * Obtener información de una variable por nombre
   */
  getVariableByName(name: string): Variable | undefined {
    return this.cachedVariables.find(v => v.name === name);
  }
}
