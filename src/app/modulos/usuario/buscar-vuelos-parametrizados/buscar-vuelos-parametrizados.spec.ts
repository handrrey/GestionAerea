import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BuscarVuelosParametrizados } from './buscar-vuelos-parametrizados';

describe('BuscarVuelosParametrizados', () => {
  let component: BuscarVuelosParametrizados;
  let fixture: ComponentFixture<BuscarVuelosParametrizados>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BuscarVuelosParametrizados],
    }).compileComponents();

    fixture = TestBed.createComponent(BuscarVuelosParametrizados);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
