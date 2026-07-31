import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from '../../shared/header/navbar/navbar.component';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { RouterOutlet } from '@angular/router';
import { SidebarService } from '../../shared/sidebar/sidebar.service';
import { PersonificarBannerComponent } from '../../../components/personificar-banner/personificar-banner.component';
import { PersonificarService } from '../../../services/personificar.service';
import { ToastModule } from 'primeng/toast';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, NavbarComponent, SidebarComponent, RouterOutlet, PersonificarBannerComponent, ToastModule],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.css']
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  isSidebarCollapsed = false;
  isPersonificando = false;
  private subscriptions: Subscription[] = [];

  constructor(
    private sidebarService: SidebarService,
    private personificarService: PersonificarService
  ) {}

  ngOnInit(): void {
    this.subscriptions.push(
      this.sidebarService.isCollapsed$.subscribe(collapsed => {
        this.isSidebarCollapsed = collapsed;
      })
    );

    this.subscriptions.push(
      this.personificarService.personificacion$.subscribe(data => {
        this.isPersonificando = data.activa;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}

