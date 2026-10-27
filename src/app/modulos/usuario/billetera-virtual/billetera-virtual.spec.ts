import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BilleteraVirtual } from './billetera-virtual';

describe('BilleteraVirtual', () => {
  let component: BilleteraVirtual;
  let fixture: ComponentFixture<BilleteraVirtual>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BilleteraVirtual],
    }).compileComponents();

    fixture = TestBed.createComponent(BilleteraVirtual);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
