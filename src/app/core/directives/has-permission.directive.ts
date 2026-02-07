import { Directive, Input, TemplateRef, ViewContainerRef, OnInit, OnDestroy } from '@angular/core';
import { PermissionService } from '../services/permission.service';
import { Subscription } from 'rxjs';

@Directive({
  selector: '[hasPermission]',
  standalone: true
})
export class HasPermissionDirective implements OnInit, OnDestroy {
  private permission: string = '';
  private subscription?: Subscription;

  @Input() set hasPermission(permission: string) {
    this.permission = permission;
    this.updateView();
  }

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private permissionService: PermissionService
  ) {}

  ngOnInit() {
    // Suscribirse a cambios en los permisos
    this.subscription = this.permissionService.permissions$.subscribe(() => {
      this.updateView();
    });
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  private updateView() {
    if (this.permissionService.hasPermission(this.permission)) {
      // Mostrar el elemento
      if (this.viewContainer.length === 0) {
        this.viewContainer.createEmbeddedView(this.templateRef);
      }
    } else {
      // Ocultar el elemento
      this.viewContainer.clear();
    }
  }
}
