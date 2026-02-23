import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TemplateService } from '../services/template.service';
import { VariableService } from '../services/variable.service';
import { Template, Variable } from '../interfaces/template.interface';

@Component({
  selector: 'app-document-generator',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './document-generator.component.html',
  styleUrls: ['./document-generator.component.css']
})
export class DocumentGeneratorComponent implements OnInit, OnDestroy {
  template: Template | null = null;
  templateVariables: Variable[] = [];
  variableForm: FormGroup;
  loading: boolean = false;
  generating: boolean = false;
  error: string | null = null;
  showPreview: boolean = false;
  previewContent: SafeHtml | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private templateService: TemplateService,
    private variableService: VariableService,
    private route: ActivatedRoute,
    private router: Router,
    private sanitizer: DomSanitizer
  ) {
    this.variableForm = this.fb.group({});
  }

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params['id']) {
        this.loadTemplate(+params['id']);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Cargar plantilla y preparar formulario
   */
  loadTemplate(id: number): void {
    this.loading = true;
    this.error = null;

    this.templateService.getById(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (template) => {
          this.template = template;
          this.prepareVariableForm();
          this.loading = false;
        },
        error: (err) => {
          console.error('Error al cargar plantilla:', err);
          this.error = 'Error al cargar la plantilla. Por favor, intente nuevamente.';
          this.loading = false;
        }
      });
  }

  /**
   * Preparar formulario con las variables de la plantilla
   */
  prepareVariableForm(): void {
    if (!this.template) return;

    // Extraer variables del contenido
    const variableNames = this.variableService.extractVariablesFromTemplate(this.template.content);
    
    // Obtener información completa de cada variable
    this.variableService.getAvailableVariables()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (allVariables) => {
          this.templateVariables = variableNames
            .map(name => allVariables.find(v => v.name === name))
            .filter(v => v !== undefined) as Variable[];

          // Crear controles del formulario
          const formControls: any = {};
          this.templateVariables.forEach(variable => {
            formControls[variable.name] = [''];
          });
          
          this.variableForm = this.fb.group(formControls);
        },
        error: (err) => {
          console.error('Error al cargar variables:', err);
        }
      });
  }

  /**
   * Generar vista previa del documento
   */
  generatePreview(): void {
    if (!this.template || this.variableForm.invalid) {
      return;
    }

    // Validar valores
    const validation = this.variableService.validateAllValues(
      this.templateVariables,
      this.variableForm.value
    );

    if (!validation.valid) {
      this.error = validation.errors.map(e => e.message).join(', ');
      return;
    }

    this.error = null;

    try {
      // Reemplazar variables
      const generatedContent = this.variableService.replaceVariables(
        this.template.content,
        this.variableForm.value
      );

      // Sanitizar y mostrar
      this.previewContent = this.sanitizer.bypassSecurityTrustHtml(generatedContent);
      this.showPreview = true;
    } catch (err) {
      console.error('Error al generar vista previa:', err);
      this.error = 'Error al generar la vista previa';
    }
  }

  /**
   * Generar documento HTML
   */
  generateHTML(): void {
    if (!this.template) return;

    this.generating = true;
    this.error = null;

    try {
      const generatedContent = this.variableService.replaceVariables(
        this.template.content,
        this.variableForm.value
      );

      // Crear blob y descargar
      const blob = new Blob([this.createHTMLDocument(generatedContent)], { type: 'text/html' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${this.sanitizeFilename(this.template.name)}.html`;
      link.click();
      window.URL.revokeObjectURL(url);

      this.generating = false;
      alert('Documento HTML generado exitosamente');
    } catch (err) {
      console.error('Error al generar HTML:', err);
      this.error = 'Error al generar el documento HTML';
      this.generating = false;
    }
  }

  /**
   * Generar documento PDF (simplificado - requiere pdfmake)
   */
  generatePDF(): void {
    alert('La generación de PDF requiere la instalación de pdfmake. Por ahora, use la opción de generar HTML.');
  }

  /**
   * Crear documento HTML completo
   */
  private createHTMLDocument(content: string): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.template?.name || 'Documento'}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
    }
    h1, h2, h3 { color: #333; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    table, th, td { border: 1px solid #ddd; }
    th, td { padding: 0.75rem; text-align: left; }
    th { background-color: #f8f9fa; }
  </style>
</head>
<body>
  ${content}
  <hr>
  <footer style="margin-top: 2rem; font-size: 0.875rem; color: #666;">
    <p>Documento generado el ${new Date().toLocaleDateString('es-ES')}</p>
    <p>Plantilla: ${this.template?.name}</p>
  </footer>
</body>
</html>
    `;
  }

  /**
   * Sanitizar nombre de archivo
   */
  private sanitizeFilename(filename: string): string {
    return filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  }

  /**
   * Cerrar vista previa
   */
  closePreview(): void {
    this.showPreview = false;
  }

  /**
   * Volver al listado
   */
  goBack(): void {
    this.router.navigate(['/templates/list']);
  }

  /**
   * Obtener tipo de input según el tipo de variable
   */
  getInputType(variable: Variable): string {
    switch (variable.type) {
      case 'email':
        return 'email';
      case 'phone':
        return 'tel';
      case 'date':
        return 'date';
      case 'number':
        return 'number';
      default:
        return 'text';
    }
  }

  /**
   * Verificar si el formulario es válido
   */
  isFormValid(): boolean {
    const validation = this.variableService.validateAllValues(
      this.templateVariables,
      this.variableForm.value
    );
    return validation.valid;
  }

  /**
   * Obtener nombre legible de categoría
   */
  getCategoryDisplayName(category: string): string {
    return category.replace(/_/g, ' ');
  }
}
