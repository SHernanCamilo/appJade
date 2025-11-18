import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-configuracion',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <button class="btn btn-back" routerLink="/organizacion"><i class="bi bi-arrow-left me-2"></i>Volver</button>
        <h1 class="page-title"><i class="bi bi-sliders me-2"></i>Configuración</h1>
        <p class="page-subtitle">Configura parámetros del sistema</p>
      </div>
      <div class="content-card">
        <div class="card-header">
          <h5 class="mb-0">Configuración General</h5>
        </div>
        <div class="card-body"><p class="text-muted">Contenido en desarrollo...</p></div>
      </div>
    </div>
  `,
  styles: [`
    .page-container{padding:2rem;max-width:1400px;margin:0 auto}.page-header{margin-bottom:2rem}.btn-back{background:#f1f5f9;border:none;padding:.5rem 1rem;border-radius:8px;color:#475569;margin-bottom:1rem}.btn-back:hover{background:#e2e8f0}.page-title{font-size:1.75rem;font-weight:700;color:#1e293b;margin-bottom:.5rem}.page-subtitle{color:#64748b}.content-card{background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.08)}.card-header{padding:1.5rem;border-bottom:1px solid #f1f5f9}.card-body{padding:1.5rem}
  `]
})
export class ConfiguracionComponent {}
