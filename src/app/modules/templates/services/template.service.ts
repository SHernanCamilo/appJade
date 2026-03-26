import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import { 
  Template, 
  CreateTemplateDto, 
  UpdateTemplateDto, 
  ApiResponse 
} from '../interfaces/template.interface';

@Injectable({
  providedIn: 'root'
})
export class TemplateService {
  private apiUrl = '/templates';
  private templatesCache = new BehaviorSubject<Template[]>([]);
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

  public templates$ = this.templatesCache.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Obtener todas las plantillas
   */
  getAll(forceRefresh: boolean = false): Observable<Template[]> {
    const now = Date.now();
    const cacheValid = (now - this.cacheTimestamp) < this.CACHE_DURATION;

    if (!forceRefresh && cacheValid && this.templatesCache.value.length > 0) {
      return this.templates$;
    }

    return this.http.get<ApiResponse<Template[]>>(this.apiUrl).pipe(
      map(response => response.data || []),
      tap(templates => {
        this.templatesCache.next(templates);
        this.cacheTimestamp = Date.now();
      })
    );
  }

  /**
   * Obtener plantilla por ID
   */
  getById(id: number): Observable<Template> {
    return this.http.get<ApiResponse<Template>>(`${this.apiUrl}/${id}`).pipe(
      map(response => {
        if (!response.data) {
          throw new Error('Plantilla no encontrada');
        }
        return response.data;
      })
    );
  }

  /**
   * Obtener plantillas por categoría
   */
  getByCategory(category: string): Observable<Template[]> {
    return this.http.get<ApiResponse<Template[]>>(`${this.apiUrl}/category/${category}`).pipe(
      map(response => response.data || [])
    );
  }

  /**
   * Crear una nueva plantilla
   */
  create(template: CreateTemplateDto): Observable<Template> {
    return this.http.post<ApiResponse<Template>>(this.apiUrl, template).pipe(
      map(response => {
        if (!response.data) {
          throw new Error('Error al crear la plantilla');
        }
        return response.data;
      }),
      tap(() => {
        // Invalidar cache
        this.cacheTimestamp = 0;
      })
    );
  }

  /**
   * Actualizar una plantilla existente
   */
  update(id: number, template: UpdateTemplateDto): Observable<Template> {
    return this.http.put<ApiResponse<Template>>(`${this.apiUrl}/${id}`, template).pipe(
      map(response => {
        if (!response.data) {
          throw new Error('Error al actualizar la plantilla');
        }
        return response.data;
      }),
      tap(() => {
        // Invalidar cache
        this.cacheTimestamp = 0;
      })
    );
  }

  /**
   * Eliminar una plantilla
   */
  delete(id: number): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${id}`).pipe(
      map(() => undefined),
      tap(() => {
        // Invalidar cache
        this.cacheTimestamp = 0;
        
        // Actualizar cache local removiendo la plantilla eliminada
        const currentTemplates = this.templatesCache.value;
        const updatedTemplates = currentTemplates.filter(t => t.id !== id);
        this.templatesCache.next(updatedTemplates);
      })
    );
  }

  /**
   * Obtener plantillas con paginación
   */
  paginate(page: number = 1, perPage: number = 15, category?: string): Observable<any> {
    let params = new HttpParams()
      .set('paginate', 'true')
      .set('page', page.toString())
      .set('per_page', perPage.toString());

    if (category) {
      params = params.set('category', category);
    }

    return this.http.get<ApiResponse<any>>(this.apiUrl, { params }).pipe(
      map(response => response.data)
    );
  }

  /**
   * Limpiar cache
   */
  clearCache(): void {
    this.templatesCache.next([]);
    this.cacheTimestamp = 0;
  }

  /**
   * Obtener plantillas del cache (síncrono)
   */
  get cachedTemplates(): Template[] {
    return this.templatesCache.value;
  }
}
