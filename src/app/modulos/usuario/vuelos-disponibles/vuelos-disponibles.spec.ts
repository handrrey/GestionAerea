import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VuelosDisponibles } from './vuelos-disponibles';

describe('VuelosDisponibles', () => {
  let component: VuelosDisponibles;
  let fixture: ComponentFixture<VuelosDisponibles>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VuelosDisponibles],
    }).compileComponents();

    fixture = TestBed.createComponent(VuelosDisponibles);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
