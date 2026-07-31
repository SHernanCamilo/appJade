import { Injectable } from '@angular/core';

export interface PerfilDraftPaciente {
  nombre: string;
  edad: string;
  sexo: string;
  peso: string;
  historia: string;
  ingreso: string;
  diagnostico: string;
  servicio: string;
  cama: string;
  alergias: '' | 'si' | 'no' | 'no_esp';
  alergiasCual: string;
  mesReferencia: string;
}

export interface PerfilDraftMedicamento {
  key: string;
  cuenta: string;
  producto: string;
  concentracion: string;
  presentacion: string;
  dosis: string;
  unidad: string;
  viaAdm: string;
  frecuencia: string;
  unidadFrecuencia: string;
  peso: string;
  dias: Record<string, string>;
}

export interface PerfilFarmacoDraft {
  documento: string;
  guardadoEn: string;
  paciente: PerfilDraftPaciente;
  medicamentos: PerfilDraftMedicamento[];
  diasDelMes: number[];
}

@Injectable({ providedIn: 'root' })
export class PerfilFarmacoterapeuticoDraftService {
  private readonly prefix = 'bi_perfil_farmaco_tmp_';

  private key(documento: string): string {
    return `${this.prefix}${documento.replace(/\D/g, '')}`;
  }

  guardar(draft: PerfilFarmacoDraft): void {
    const doc = draft.documento.replace(/\D/g, '');
    if (!doc) {
      throw new Error('Documento inválido para guardado temporal.');
    }
    localStorage.setItem(this.key(doc), JSON.stringify({
      ...draft,
      documento: doc,
      guardadoEn: new Date().toISOString()
    }));
  }

  obtener(documento: string): PerfilFarmacoDraft | null {
    const doc = documento.replace(/\D/g, '');
    if (!doc) {
      return null;
    }
    const raw = localStorage.getItem(this.key(doc));
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as PerfilFarmacoDraft;
      if (!parsed?.paciente || !Array.isArray(parsed.medicamentos)) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  eliminar(documento: string): void {
    const doc = documento.replace(/\D/g, '');
    if (!doc) {
      return;
    }
    localStorage.removeItem(this.key(doc));
  }

  existe(documento: string): boolean {
    return this.obtener(documento) !== null;
  }
}
