import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CardModule } from 'primeng/card';
import { RippleModule } from 'primeng/ripple';
import { SidebarService } from '../../complements/shared/sidebar/sidebar.service';
import { ModuleDashboardCard, ModuleDashboardService } from '../../core/services/module-dashboard.service';

@Component({
  selector: 'app-inventario',
  standalone: true,
  imports: [CommonModule, RouterModule, CardModule, RippleModule],
  templateUrl: './inventario.component.html',
  styleUrl: './inventario.component.css'
})
export class InventarioComponent implements OnInit {
  private readonly sidebarService = inject(SidebarService);
  private readonly moduleDashboardService = inject(ModuleDashboardService);
  private readonly destroyRef = inject(DestroyRef);

  dashboardCards: ModuleDashboardCard[] = [];

  ngOnInit(): void {
    this.sidebarService.modulos$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.dashboardCards = this.moduleDashboardService.buildDashboardCards('/inventario');
      });
  }
}
