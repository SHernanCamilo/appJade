import { Injectable } from '@angular/core';

export interface LugarGeo {
  id: number;
  name: string;
}

interface DepartamentoApi extends LugarGeo {
  cityCapitalId?: number;
}

interface MunicipioApi extends LugarGeo {
  departmentId: number;
}

const API = 'https://api-colombia.com/api/v1';

@Injectable({ providedIn: 'root' })
export class ColombiaGeografiaService {
  private departamentos: LugarGeo[] | null = null;
  private departamentosPromise: Promise<LugarGeo[]> | null = null;
  private readonly municipios = new Map<number, LugarGeo[]>();
  private readonly municipiosPromise = new Map<number, Promise<LugarGeo[]>>();

  listarDepartamentos(): Promise<LugarGeo[]> {
    if (this.departamentos) {
      return Promise.resolve(this.departamentos);
    }
    if (!this.departamentosPromise) {
      this.departamentosPromise = this.cargarDepartamentos().catch(err => {
        this.departamentosPromise = null;
        throw err;
      });
    }
    return this.departamentosPromise;
  }

  listarMunicipios(departmentId: number): Promise<LugarGeo[]> {
    const cache = this.municipios.get(departmentId);
    if (cache) {
      return Promise.resolve(cache);
    }
    let pending = this.municipiosPromise.get(departmentId);
    if (!pending) {
      pending = this.cargarMunicipios(departmentId).catch(err => {
        this.municipiosPromise.delete(departmentId);
        throw err;
      });
      this.municipiosPromise.set(departmentId, pending);
    }
    return pending;
  }

  private async cargarDepartamentos(): Promise<LugarGeo[]> {
    const data = await this.getJson<DepartamentoApi[]>(`${API}/Department`);
    const lista = data
      .filter(item => item?.id && item?.name)
      .map(item => ({ id: item.id, name: item.name.trim() }));

    lista.sort((a, b) => {
      const huilaA = this.esHuila(a.name);
      const huilaB = this.esHuila(b.name);
      if (huilaA !== huilaB) {
        return huilaA ? -1 : 1;
      }
      return a.name.localeCompare(b.name, 'es');
    });

    this.departamentos = lista;
    return lista;
  }

  private async cargarMunicipios(departmentId: number): Promise<LugarGeo[]> {
    const data = await this.getJson<MunicipioApi[]>(`${API}/Department/${departmentId}/cities`);
    const lista = data
      .filter(item => item?.id && item?.name)
      .map(item => ({ id: item.id, name: item.name.trim() }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));

    this.municipios.set(departmentId, lista);
    return lista;
  }

  private esHuila(nombre: string): boolean {
    return nombre.trim().toLocaleLowerCase('es') === 'huila';
  }

  private async getJson<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`No se pudo consultar ${url}`);
    }
    return response.json() as Promise<T>;
  }
}
