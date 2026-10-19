import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GestionVuelos } from './gestion-vuelos';

describe('GestionVuelos', () => {
  let component: GestionVuelos;
  let fixture: ComponentFixture<GestionVuelos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GestionVuelos],
    }).compileComponents();

    fixture = TestBed.createComponent(GestionVuelos);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
