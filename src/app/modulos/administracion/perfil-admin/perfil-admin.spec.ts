import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PerfilAdmin } from './perfil-admin';

describe('PerfilAdmin', () => {
  let component: PerfilAdmin;
  let fixture: ComponentFixture<PerfilAdmin>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PerfilAdmin],
    }).compileComponents();

    fixture = TestBed.createComponent(PerfilAdmin);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
