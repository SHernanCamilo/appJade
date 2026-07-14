import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { TableModule } from 'primeng/table';
import { TabViewModule } from 'primeng/tabview';
import { MessageService, ConfirmationService } from 'primeng/api';
import { environment } from '../../../../environments/environment';
import {
  OdataLinksService,
  OdataLink,
  OdataApiKey,
  VistaPermissionUser,
  OdataLinkCreatePayload
} from './services/odata-links.service';
import {
  BiGrupoService,
  BiVista,
  FabricCatalogView
} from '../esquemas/services/bi-grupo.service';

interface UsuarioOption {
  label: string;
  value: number;
}

@Component({
  selector: 'app-odata-links',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    DropdownModule,
    InputTextModule,
    ToastModule,
    ConfirmDialogModule,
    TagModule,
    TooltipModule,
    TableModule,
    TabViewModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './odataLinks.component.html',
  styleUrl: './odataLinks.component.css'
})
export class OdataLinksComponent implements OnInit {
  activeTabIndex = 0;

  // ─── Links ──────────────────────────────────────────
  links: OdataLink[] = [];
  isLoadingLinks = false;

  // ─── API Keys ───────────────────────────────────────
  apiKeys: OdataApiKey[] = [];
  isLoadingKeys = false;

  // ─── Permisos ───────────────────────────────────────
  esquemas: { label: string; value: string; grupoId: number }[] = [];
  selectedSchema = '';
  selectedGrupoId: number | null = null;
  isLoadingEsquemas = false;

  vistas: BiVista[] = [];
  selectedVistaId: number | null = null;
  isLoadingVistas = false;

  permittedUsers: VistaPermissionUser[] = [];
  isLoadingPermissions = false;

  usuariosOptions: UsuarioOption[] = [];
  selectedUserId: number | null = null;
  isLoadingUsuarios = false;
  isAddingPermission = false;

  // ─── Crear Link Dialog ──────────────────────────────
  showCreateDialog = false;
  newLinkName = '';
  newLinkVisibility: 'private' | 'organizational' | 'public' = 'private';
  newLinkSchema = '';
  newLinkView = '';
  newLinkMaxRows = 100000;
  isCreatingLink = false;
  fabricViews: FabricCatalogView[] = [];
  isLoadingFabricViews = false;

  // ─── API Key Dialog ─────────────────────────────────
  showKeyDialog = false;
  newKeyName = '';
  newKeyDays: number | null = null;
  isCreatingKey = false;

  // ─── Resultado ──────────────────────────────────────
  showResultDialog = false;
  resultUrl = '';
  resultToken = '';
  resultKey = '';
  resultWarning = '';

  visibilityOptions = [
    { label: 'Privado (solo creador)', value: 'private' },
    { label: 'Organizacional (@medilaser)', value: 'organizational' },
    { label: 'Público (con token)', value: 'public' }
  ];

  constructor(
    private odataService: OdataLinksService,
    private biGrupoService: BiGrupoService,
    private http: HttpClient,
    private messageService: MessageService,
    private confirmationService: ConfirmationService
  ) {}

  ngOnInit(): void {
    this.loadLinks();
    this.loadApiKeys();
    this.loadEsquemas();
  }

  onTabChange(index: number): void {
    this.activeTabIndex = index;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LINKS TAB
  // ═══════════════════════════════════════════════════════════════════════════

  loadLinks(): void {
    this.isLoadingLinks = true;
    this.odataService.getLinks().subscribe({
      next: links => {
        this.links = links;
        this.isLoadingLinks = false;
      },
      error: () => {
        this.isLoadingLinks = false;
        this.showError('Error al cargar los links OData');
      }
    });
  }

  openCreateDialog(): void {
    this.showCreateDialog = true;
    this.newLinkName = '';
    this.newLinkVisibility = 'private';
    this.newLinkSchema = '';
    this.newLinkView = '';
    this.newLinkMaxRows = 100000;
    this.fabricViews = [];
  }

  onNewLinkSchemaChange(): void {
    this.newLinkView = '';
    this.fabricViews = [];
    if (!this.newLinkSchema) return;

    this.isLoadingFabricViews = true;
    this.biGrupoService.getCatalogoFabric(this.newLinkSchema).subscribe({
      next: views => {
        this.fabricViews = views;
        this.isLoadingFabricViews = false;
      },
      error: () => {
        this.fabricViews = [];
        this.isLoadingFabricViews = false;
      }
    });
  }

  get fabricViewOptions(): { label: string; value: string }[] {
    return this.fabricViews.map(v => ({ label: v.view_name, value: v.view_name }));
  }

  createLink(): void {
    if (!this.newLinkName || !this.newLinkSchema || !this.newLinkView) {
      this.showWarn('Complete todos los campos obligatorios');
      return;
    }

    this.isCreatingLink = true;
    const payload: OdataLinkCreatePayload = {
      name: this.newLinkName,
      visibility: this.newLinkVisibility,
      schema_name: this.newLinkSchema.toLowerCase(),
      view_name: this.newLinkView,
      max_rows: this.newLinkMaxRows
    };

    this.odataService.createLink(payload).subscribe({
      next: res => {
        this.isCreatingLink = false;
        this.showCreateDialog = false;
        this.loadLinks();

        this.resultUrl = res.data.full_url || res.data.url;
        this.resultToken = res.data.public_token || '';
        this.resultKey = '';
        this.resultWarning = res.data.warning || '';
        this.showResultDialog = true;

        this.showSuccess('Link OData creado exitosamente');
      },
      error: err => {
        this.isCreatingLink = false;
        this.showError(err?.error?.message || 'Error al crear el link');
      }
    });
  }

  deactivateLink(link: OdataLink): void {
    this.confirmationService.confirm({
      message: `¿Desactivar el link "${link.name}"?`,
      header: 'Confirmar desactivación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Desactivar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.odataService.deactivateLink(link.id).subscribe({
          next: () => {
            this.links = this.links.map(l =>
              l.id === link.id ? { ...l, active: false } : l
            );
            this.showSuccess('Link desactivado');
          },
          error: () => this.showError('Error al desactivar el link')
        });
      }
    });
  }

  copyUrl(url: string): void {
    navigator.clipboard.writeText(url).then(() => {
      this.showSuccess('URL copiada al portapapeles');
    });
  }

  getVisibilityLabel(v: string): string {
    return this.visibilityOptions.find(o => o.value === v)?.label ?? v;
  }

  getVisibilitySeverity(v: string): 'success' | 'warn' | 'danger' | 'info' | 'secondary' {
    switch (v) {
      case 'private': return 'info';
      case 'organizational': return 'success';
      case 'public': return 'warn';
      default: return 'secondary';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // API KEYS TAB
  // ═══════════════════════════════════════════════════════════════════════════

  loadApiKeys(): void {
    this.isLoadingKeys = true;
    this.odataService.getApiKeys().subscribe({
      next: keys => {
        this.apiKeys = keys;
        this.isLoadingKeys = false;
      },
      error: () => {
        this.isLoadingKeys = false;
        this.showError('Error al cargar las API Keys');
      }
    });
  }

  openKeyDialog(): void {
    this.showKeyDialog = true;
    this.newKeyName = '';
    this.newKeyDays = null;
  }

  createApiKey(): void {
    if (!this.newKeyName) {
      this.showWarn('Ingrese un nombre para la API Key');
      return;
    }

    this.isCreatingKey = true;
    this.odataService.createApiKey(this.newKeyName, this.newKeyDays ?? undefined).subscribe({
      next: res => {
        this.isCreatingKey = false;
        this.showKeyDialog = false;
        this.loadApiKeys();

        this.resultUrl = '';
        this.resultToken = '';
        this.resultKey = res.data.key;
        this.resultWarning = res.warning || '';
        this.showResultDialog = true;

        this.showSuccess('API Key generada exitosamente');
      },
      error: err => {
        this.isCreatingKey = false;
        this.showError(err?.error?.message || 'Error al generar la API Key');
      }
    });
  }

  revokeApiKey(key: OdataApiKey): void {
    this.confirmationService.confirm({
      message: `¿Revocar la API Key "${key.name}" (${key.key_prefix}...)?`,
      header: 'Confirmar revocación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Revocar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.odataService.revokeApiKey(key.id).subscribe({
          next: () => {
            this.apiKeys = this.apiKeys.map(k =>
              k.id === key.id ? { ...k, active: false } : k
            );
            this.showSuccess('API Key revocada');
          },
          error: () => this.showError('Error al revocar la API Key')
        });
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PERMISOS TAB
  // ═══════════════════════════════════════════════════════════════════════════

  loadEsquemas(): void {
    this.isLoadingEsquemas = true;
    this.biGrupoService.getGrupos().subscribe({
      next: grupos => {
        this.esquemas = grupos.map(g => ({
          label: `${g.codigo} — ${g.descripcion ?? 'Sin descripción'}`,
          value: g.codigo.toLowerCase(),
          grupoId: g.id
        }));
        this.isLoadingEsquemas = false;
      },
      error: () => {
        this.isLoadingEsquemas = false;
        this.showError('Error al cargar los esquemas');
      }
    });
  }

  onSchemaChange(): void {
    this.selectedVistaId = null;
    this.permittedUsers = [];
    this.vistas = [];
    if (!this.selectedSchema) return;

    const grupo = this.esquemas.find(e => e.value === this.selectedSchema);
    this.selectedGrupoId = grupo?.grupoId ?? null;
    if (!this.selectedGrupoId) return;

    this.isLoadingVistas = true;
    this.biGrupoService.getGrupo(this.selectedGrupoId).subscribe({
      next: detalle => {
        this.vistas = detalle.vistas ?? [];
        this.isLoadingVistas = false;
      },
      error: () => {
        this.vistas = [];
        this.isLoadingVistas = false;
      }
    });
  }

  get vistaOptions(): { label: string; value: number }[] {
    return this.vistas.map(v => ({ label: v.nombre, value: v.id }));
  }

  onVistaChange(): void {
    this.permittedUsers = [];
    if (!this.selectedVistaId) return;
    this.loadPermissions();
    this.loadUsuarios();
  }

  loadPermissions(): void {
    if (!this.selectedVistaId) return;
    this.isLoadingPermissions = true;
    this.odataService.getPermissions(this.selectedVistaId).subscribe({
      next: users => {
        this.permittedUsers = users;
        this.isLoadingPermissions = false;
      },
      error: () => {
        this.permittedUsers = [];
        this.isLoadingPermissions = false;
      }
    });
  }

  loadUsuarios(): void {
    this.isLoadingUsuarios = true;
    this.http.get<{ id: number; name: string; email: string }[]>(
      `${environment.URL_SERVICIOS}/users`
    ).subscribe({
      next: users => {
        this.usuariosOptions = (users ?? []).map(u => ({
          label: `${u.name} (${u.email})`,
          value: u.id
        }));
        this.isLoadingUsuarios = false;
      },
      error: () => {
        this.usuariosOptions = [];
        this.isLoadingUsuarios = false;
      }
    });
  }

  get availableUsuarios(): UsuarioOption[] {
    const assignedIds = new Set(this.permittedUsers.map(u => u.id));
    return this.usuariosOptions.filter(o => !assignedIds.has(o.value));
  }

  addPermission(): void {
    if (!this.selectedVistaId || !this.selectedUserId) {
      this.showWarn('Seleccione un usuario');
      return;
    }

    this.isAddingPermission = true;
    this.odataService.addPermission(this.selectedVistaId, this.selectedUserId).subscribe({
      next: () => {
        this.isAddingPermission = false;
        this.selectedUserId = null;
        this.loadPermissions();
        this.showSuccess('Permiso asignado correctamente');
      },
      error: err => {
        this.isAddingPermission = false;
        this.showError(err?.error?.message || 'Error al asignar permiso');
      }
    });
  }

  removePermission(user: VistaPermissionUser): void {
    if (!this.selectedVistaId) return;

    this.confirmationService.confirm({
      message: `¿Revocar el permiso de actualización de Excel para ${user.name}?`,
      header: 'Confirmar',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Revocar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.odataService.removePermission(this.selectedVistaId!, user.id).subscribe({
          next: () => {
            this.permittedUsers = this.permittedUsers.filter(u => u.id !== user.id);
            this.showSuccess('Permiso revocado');
          },
          error: () => this.showError('Error al revocar el permiso')
        });
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      this.showSuccess('Copiado al portapapeles');
    });
  }

  private showSuccess(detail: string): void {
    this.messageService.add({ severity: 'success', summary: 'Éxito', detail });
  }

  private showWarn(detail: string): void {
    this.messageService.add({ severity: 'warn', summary: 'Atención', detail });
  }

  private showError(detail: string): void {
    this.messageService.add({ severity: 'error', summary: 'Error', detail });
  }
}
