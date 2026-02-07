import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CardModule } from 'primeng/card';
import { RippleModule } from 'primeng/ripple';

@Component({
  selector: 'app-organizacion',
  standalone: true,
  imports: [CommonModule, RouterModule, CardModule, RippleModule],
  templateUrl: './organizacion.component.html',
  styleUrl: './organizacion.component.css'
})
export class OrganizacionComponent {
  dashboardCards = [
    {
      title: 'Empresa',
      icon: 'bi-building',
      description: 'Gestión de empresas, sucursales y sedes',
      color: 'primary',
      items: [
        { name: 'Maestro de Empresas', route: '/organizacion/empresa/maestro', icon: 'bi-building-fill' },
        { name: 'Sucursales', route: '/organizacion/empresa/sucursales', icon: 'bi-shop' },
        { name: 'Sedes', route: '/organizacion/empresa/sedes', icon: 'bi-geo-alt-fill' },
        { name: 'Módulos', route: '/organizacion/empresa/modulos', icon: 'bi-grid-3x3-gap' }
      ]
    },
    {
      title: 'Usuario',
      icon: 'bi-people',
      description: 'Administración de usuarios y permisos',
      color: 'success',
      items: [
        { name: 'Creación de Usuario', route: '/organizacion/usuario/crear', icon: 'bi-person-plus-fill' },
        { name: 'Roles', route: '/organizacion/usuario/roles', icon: 'bi-shield-check' },
        { name: 'Perfiles', route: '/organizacion/usuario/perfiles', icon: 'bi-person-badge' },
        { name: 'Permiso', route: '/organizacion/usuario/permisos', icon: 'bi-shield-lock-fill' }
      ]
    },
    {
      title: 'Servicios',
      icon: 'bi-gear',
      description: 'Configuración de módulos y reportes',
      color: 'info',
      items: [
        { name: 'Reportes', route: '/organizacion/servicios/reportes', icon: 'bi-file-earmark-bar-graph' },
        { name: 'Configuración', route: '/organizacion/servicios/configuracion', icon: 'bi-sliders' }
      ]
    }
  ];
}
