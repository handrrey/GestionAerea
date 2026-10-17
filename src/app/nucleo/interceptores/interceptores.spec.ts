import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Interceptores } from './interceptores';

describe('Interceptores', () => {
  let component: Interceptores;
  let fixture: ComponentFixture<Interceptores>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Interceptores],
    }).compileComponents();

    fixture = TestBed.createComponent(Interceptores);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
