import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GestionAdministradores } from './gestion-administradores';

describe('GestionAdministradores', () => {
  let component: GestionAdministradores;
  let fixture: ComponentFixture<GestionAdministradores>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GestionAdministradores],
    }).compileComponents();

    fixture = TestBed.createComponent(GestionAdministradores);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
