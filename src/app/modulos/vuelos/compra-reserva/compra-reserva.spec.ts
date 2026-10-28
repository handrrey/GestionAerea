import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CompraReserva } from './compra-reserva';

describe('CompraReserva', () => {
  let component: CompraReserva;
  let fixture: ComponentFixture<CompraReserva>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompraReserva],
    }).compileComponents();

    fixture = TestBed.createComponent(CompraReserva);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
