import { Directive, Input, TemplateRef, ViewContainerRef, OnInit, OnDestroy } from '@angular/core';
import { AuthService } from '../../modules/auth/auth.service';
import { Subscription } from 'rxjs';

@Directive({
  selector: '[hasRole]',
  standalone: true
})
export class HasRoleDirective implements OnInit, OnDestroy {
  private role: string = '';
  private subscription?: Subscription;

  @Input() set hasRole(role: string) {
    this.role = role;
    this.updateView();
  }

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private authService: AuthService
  ) {}

  ngOnInit() {
    // Suscribirse a cambios en el usuario actual
    this.subscription = this.authService.currentUser$.subscribe(() => {
      this.updateView();
    });
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  private updateView() {
    const user = this.authService.currentUser;
    const hasRole = user && user.roles && user.roles.includes(this.role);

    if (hasRole) {
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
