import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SidebarService {
  private isCollapsedSubject = new BehaviorSubject<boolean>(false);
  public isCollapsed$: Observable<boolean> = this.isCollapsedSubject.asObservable();

  private isMobileOpenSubject = new BehaviorSubject<boolean>(false);
  public isMobileOpen$: Observable<boolean> = this.isMobileOpenSubject.asObservable();

  toggleSidebar(): void {
    this.isCollapsedSubject.next(!this.isCollapsedSubject.value);
  }

  toggleMobileSidebar(): void {
    this.isMobileOpenSubject.next(!this.isMobileOpenSubject.value);
  }

  closeMobileSidebar(): void {
    this.isMobileOpenSubject.next(false);
  }

  getSidebarState(): boolean {
    return this.isCollapsedSubject.value;
  }

  getMobileSidebarState(): boolean {
    return this.isMobileOpenSubject.value;
  }
}
