import { Injectable } from '@angular/core';
import { GlpiAnsOpcion } from '../interfaces/glpi-plantilla.interface';

@Injectable()
export class GlpiCategoriaBusqueda {
  texto = '';
}

@Injectable()
export class GlpiCategoriaAnsOpciones {
  opciones: GlpiAnsOpcion[] = [];
}
