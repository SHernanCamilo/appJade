import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { OrdenesCompraComponent } from './ordenes-compra.component';
import { InventarioService } from '../../../core/services/inventario.service';

describe('OrdenesCompraComponent', () => {
  let component: OrdenesCompraComponent;
  let fixture: ComponentFixture<OrdenesCompraComponent>;

  // Stub del servicio para evitar llamadas HTTP reales en la creación del componente.
  const inventarioServiceStub: Partial<InventarioService> = {
    getSucursalesDisponibles: () => of({ success: true, data: [] } as any),
    getOrdenesCompra: () => of({ success: true, data: [] } as any),
    getPedidos: () => of({ success: true, data: [] } as any),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrdenesCompraComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: InventarioService, useValue: inventarioServiceStub },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap({}) },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrdenesCompraComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('canEdit debe ser falso para órdenes sincronizadas', () => {
    const oc: any = { es_sincronizada: true, puede_editar: false, estado: 'pendiente' };
    expect(component.canEdit(oc)).toBeFalse();
  });

  it('canEdit debe ser verdadero para órdenes propias del aplicativo pendientes', () => {
    const oc: any = { es_sincronizada: false, puede_editar: true, estado: 'pendiente' };
    expect(component.canEdit(oc)).toBeTrue();
  });

  it('isSincronizada detecta oc_indigo', () => {
    expect(component.isSincronizada({ oc_indigo: '0000123' } as any)).toBeTrue();
    expect(component.isSincronizada({} as any)).toBeFalse();
  });
});
