import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecepcionesTecnicasComponent } from './recepciones-tecnicas.component';

describe('RecepcionesTecnicasComponent', () => {
  let component: RecepcionesTecnicasComponent;
  let fixture: ComponentFixture<RecepcionesTecnicasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecepcionesTecnicasComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RecepcionesTecnicasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
