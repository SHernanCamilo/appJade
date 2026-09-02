import { Injectable } from '@angular/core';
import { GlpiAnsOpcion } from '../interfaces/glpi-plantilla.interface';

@Injectable()
export class GlpiCategoriaBusqueda {
  texto = '';
  ans = '';

  get hayFiltro(): boolean {
    return this.normalizar(this.texto).length > 0 || this.normalizar(this.ans).length > 0;
  }

  nodoCoincide(nombre: unknown, ansNombre: unknown): boolean {
    const q = this.normalizar(this.texto);
    const ansFiltro = this.normalizar(this.ans);
    const nom = this.normalizar(nombre);
    const ans = this.normalizar(ansNombre);
    const textoOk = !q || nom.includes(q) || ans.includes(q);
    const ansOk = !ansFiltro || ans === ansFiltro;
    return textoOk && ansOk;
  }

  normalizar(valor: unknown): string {
    return String(valor || '')
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }
}

@Injectable()
export class GlpiCategoriaAnsOpciones {
  opciones: GlpiAnsOpcion[] = [];
}
