import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TemplateService } from '../services/template.service';
import { Template } from '../interfaces/template.interface';

@Component({
  selector: 'app-template-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './template-list.component.html',
  styleUrls: ['./template-list.component.css']
})
export class TemplateListComponent implements OnInit, OnDestroy {
  templates: Template[] = [];
  filteredTemplates: Template[] = [];
  selectedCategory: string | null = null;
  loading: boolean = false;
  error: string | null = null;
  
  categories: string[] = [
    'Informes',
    'Contratos',
    'Formatos_IRS',
    'Documentos_Administrativos',
    'Otros'
  ];

  private destroy$ = new Subject<void>();

  constructor(
    private templateService: TemplateService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadTemplates();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Cargar todas las plantillas
   */
  loadTemplates(): void {
    this.loading = true;
    this.error = null;

    this.templateService.getAll(true)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (templates) => {
          this.templates = templates;
          this.applyFilter();
          this.loading = false;
        },
        error: (err) => {
          console.error('Error al cargar plantillas:', err);
          this.error = 'Error al cargar las plantillas. Por favor, intente nuevamente.';
          this.loading = false;
        }
      });
  }

  /**
   * Filtrar plantillas por categoría
   */
  filterByCategory(category: string | null): void {
    this.selectedCategory = category;
    this.applyFilter();
  }

  /**
   * Aplicar filtro actual
   */
  private applyFilter(): void {
    if (this.selectedCategory) {
      this.filteredTemplates = this.templates.filter(
        t => t.category === this.selectedCategory
      );
    } else {
      this.filteredTemplates = [...this.templates];
    }
  }

  /**
   * Navegar a crear nueva plantilla
   */
  navigateToCreate(): void {
    this.router.navigate(['/templates/create']);
  }

  /**
   * Navegar a editar plantilla
   */
  navigateToEdit(id: number): void {
    this.router.navigate(['/templates/edit', id]);
  }

  /**
   * Navegar a generar documento
   */
  navigateToGenerate(id: number): void {
    this.router.navigate(['/templates/generate', id]);
  }

  /**
   * Eliminar plantilla con confirmación
   */
  deleteTemplate(template: Template): void {
    const confirmMessage = `¿Está seguro de que desea eliminar la plantilla "${template.name}"?`;
    
    if (confirm(confirmMessage)) {
      this.loading = true;
      
      this.templateService.delete(template.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            // Remover de la lista local
            this.templates = this.templates.filter(t => t.id !== template.id);
            this.applyFilter();
            this.loading = false;
            alert('Plantilla eliminada exitosamente');
          },
          error: (err) => {
            console.error('Error al eliminar plantilla:', err);
            alert('Error al eliminar la plantilla. Por favor, intente nuevamente.');
            this.loading = false;
          }
        });
    }
  }

  /**
   * Formatear fecha para mostrar
   */
  formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Obtener nombre legible de categoría
   */
  getCategoryDisplayName(category: string): string {
    return category.replace(/_/g, ' ');
  }
}
