import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { EditorModule, TINYMCE_SCRIPT_SRC } from '@tinymce/tinymce-angular';
import { TemplateService } from '../services/template.service';
import { VariableService } from '../services/variable.service';
import { Template, Variable } from '../interfaces/template.interface';

@Component({
  selector: 'app-template-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, EditorModule],
  providers: [
    { provide: TINYMCE_SCRIPT_SRC, useValue: 'tinymce/tinymce.min.js' }
  ],
  templateUrl: './template-editor.component.html',
  styleUrls: ['./template-editor.component.css']
})
export class TemplateEditorComponent implements OnInit, OnDestroy {
  templateForm: FormGroup;
  isEditMode: boolean = false;
  templateId: number | null = null;
  loading: boolean = false;
  saving: boolean = false;
  error: string | null = null;
  availableVariables: Variable[] = [];
  editorContent: string = ''; // Contenido del editor TinyMCE
  
  categories: string[] = [
    'Informes',
    'Contratos',
    'Formatos_IRS',
    'Documentos_Administrativos',
    'Otros'
  ];

  // Configuración de TinyMCE
  editorConfig: any = {
    base_url: '/tinymce',
    suffix: '.min',
    height: 600,
    menubar: true,
    language: 'es',
    promotion: false,
    branding: false,
    plugins: [
      'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
      'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
      'insertdatetime', 'media', 'table', 'help', 'wordcount'
    ],
    toolbar: 'undo redo | formatselect | bold italic underline strikethrough | ' +
      'alignleft aligncenter alignright alignjustify | ' +
      'bullist numlist outdent indent | table | ' +
      'forecolor backcolor | removeformat | help',
    toolbar_mode: 'sliding',
    content_style: `
      body { 
        font-family: Arial, Helvetica, sans-serif; 
        font-size: 12pt;
        padding: 20px;
      }
      table {
        border-collapse: collapse;
        width: 100%;
      }
      table td, table th {
        border: 1px solid #000;
        padding: 8px;
      }
    `,
    style_formats: [
      { title: 'Encabezados', items: [
        { title: 'Encabezado 1', format: 'h1' },
        { title: 'Encabezado 2', format: 'h2' },
        { title: 'Encabezado 3', format: 'h3' },
        { title: 'Encabezado 4', format: 'h4' }
      ]},
      { title: 'Bloques', items: [
        { title: 'Párrafo', format: 'p' },
        { title: 'Cita', format: 'blockquote' },
        { title: 'Código', format: 'pre' }
      ]},
      { title: 'Alineación', items: [
        { title: 'Izquierda', format: 'alignleft' },
        { title: 'Centro', format: 'aligncenter' },
        { title: 'Derecha', format: 'alignright' },
        { title: 'Justificado', format: 'alignjustify' }
      ]}
    ],
    table_default_attributes: {
      border: '1'
    },
    table_default_styles: {
      'border-collapse': 'collapse',
      'width': '100%'
    },
    // Configuración para sincronizar con Angular
    setup: (editor: any) => {
      editor.on('init', () => {
        // Sincronizar contenido inicial
        if (this.editorContent) {
          editor.setContent(this.editorContent);
        }
      });
    }
  };

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private templateService: TemplateService,
    private variableService: VariableService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.templateForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(255)]],
      category: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadAvailableVariables();
    
    // Verificar si estamos en modo edición
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params['id']) {
        this.isEditMode = true;
        this.templateId = +params['id'];
        this.loadTemplate(this.templateId);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Cargar variables disponibles
   */
  loadAvailableVariables(): void {
    this.variableService.getAvailableVariables()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (variables) => {
          this.availableVariables = variables;
        },
        error: (err) => {
          console.error('Error al cargar variables:', err);
        }
      });
  }

  /**
   * Cargar plantilla existente para editar
   */
  loadTemplate(id: number): void {
    this.loading = true;
    this.error = null;

    this.templateService.getById(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (template) => {
          this.templateForm.patchValue({
            name: template.name,
            category: template.category
          });
          this.editorContent = template.content;
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
   * Insertar variable en el contenido (TinyMCE)
   */
  insertVariable(variable: Variable): void {
    // Insertar la variable sin el span, TinyMCE la mostrará con el estilo
    const variableTag = `{{${variable.name}}}`;
    
    // Insertar al final del contenido actual con un espacio
    this.editorContent = this.editorContent + (this.editorContent ? ' ' : '') + variableTag + ' ';
  }

  /**
   * Guardar plantilla
   */
  saveTemplate(): void {
    // Validar campos básicos
    if (this.templateForm.invalid) {
      this.markFormGroupTouched(this.templateForm);
      return;
    }

    // Obtener el contenido del editor
    let content = this.editorContent || '';
    
    // Limpiar etiquetas vacías de TinyMCE
    content = content.replace(/<p><\/p>/g, '').replace(/<p>&nbsp;<\/p>/g, '').trim();

    // Validar que el contenido no esté vacío después de limpiar
    if (!content || content === '') {
      this.error = 'El contenido de la plantilla es obligatorio';
      return;
    }

    this.saving = true;
    this.error = null;
    
    // Crear un div temporal para decodificar HTML entities
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    content = tempDiv.innerHTML;
    
    // Decodificar entidades HTML comunes que afectan las variables
    content = content.replace(/&lt;/g, '<');
    content = content.replace(/&gt;/g, '>');
    content = content.replace(/&amp;/g, '&');
    content = content.replace(/&quot;/g, '"');
    content = content.replace(/&#39;/g, "'");
    content = content.replace(/&nbsp;/g, ' ');
    
    // Asegurar que las llaves de variables estén correctas
    // Convertir cualquier variación a {{variable}}
    content = content.replace(/\{\s*\{([a-zA-Z0-9_]+)\}\s*\}/g, '{{$1}}');
    content = content.replace(/\{([a-zA-Z0-9_]+)\}/g, '{{$1}}');
    
    // Convertir spans de variables a texto plano
    content = content.replace(/<span[^>]*>({{[a-zA-Z0-9_]+}})<\/span>/g, '$1');
    
    const formValue = {
      name: this.templateForm.get('name')?.value,
      category: this.templateForm.get('category')?.value,
      content: content
    };

    // console.log('=== CONTENIDO FINAL ===');
    // console.log(content);
    // console.log('=== DATOS A ENVIAR ===');
    // console.log(formValue);

    const operation = this.isEditMode && this.templateId
      ? this.templateService.update(this.templateId, formValue)
      : this.templateService.create(formValue);

    operation.pipe(takeUntil(this.destroy$)).subscribe({
      next: (template) => {
        this.saving = false;
        alert(`Plantilla ${this.isEditMode ? 'actualizada' : 'creada'} exitosamente`);
        this.router.navigate(['/templates/list']);
      },
      error: (err) => {
        console.error('=== ERROR COMPLETO ===');
        console.error(err);
        console.error('=== RESPUESTA DEL SERVIDOR ===');
        console.error(err.error);
        
        // Extraer mensaje de error detallado
        let errorMessage = 'Error al guardar la plantilla.';
        
        if (err.error?.error?.details && Array.isArray(err.error.error.details)) {
          errorMessage = err.error.error.details.map((d: any) => {
            if (d.variable) {
              return `Variable '${d.variable}': ${d.message}`;
            }
            return d.message;
          }).join('\n');
        } else if (err.error?.error?.message) {
          errorMessage = err.error.error.message;
        } else if (err.error?.message) {
          errorMessage = err.error.message;
        }
        
        this.error = errorMessage;
        this.saving = false;
      }
    });
  }

  /**
   * Cancelar y volver al listado
   */
  cancel(): void {
    if (confirm('¿Está seguro de que desea cancelar? Los cambios no guardados se perderán.')) {
      this.router.navigate(['/templates/list']);
    }
  }

  /**
   * Marcar todos los campos del formulario como tocados
   */
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  /**
   * Verificar si un campo tiene error
   */
  hasError(fieldName: string): boolean {
    const field = this.templateForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  /**
   * Obtener mensaje de error de un campo
   */
  getErrorMessage(fieldName: string): string {
    const field = this.templateForm.get(fieldName);
    if (!field || !field.errors) return '';

    if (field.errors['required']) {
      return 'Este campo es obligatorio';
    }
    if (field.errors['maxlength']) {
      return `Máximo ${field.errors['maxlength'].requiredLength} caracteres`;
    }
    return 'Campo inválido';
  }

  /**
   * Vista previa del contenido
   */
  previewContent(): void {
    const content = this.editorContent;
    if (!content) {
      alert('No hay contenido para previsualizar');
      return;
    }

    // Abrir en nueva ventana
    const previewWindow = window.open('', '_blank');
    if (previewWindow) {
      previewWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Vista Previa - ${this.templateForm.get('name')?.value || 'Plantilla'}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 2rem; max-width: 800px; margin: 0 auto; }
            .variable { background: #fff3cd; padding: 2px 4px; border-radius: 3px; }
          </style>
        </head>
        <body>
          ${content.replace(/\{\{([^}]+)\}\}/g, '<span class="variable">{{$1}}</span>')}
        </body>
        </html>
      `);
      previewWindow.document.close();
    }
  }

  /**
   * Obtener nombre legible de categoría
   */
  getCategoryDisplayName(category: string): string {
    return category.replace(/_/g, ' ');
  }
}
