import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AutenticacionService } from '../../nucleo/servicios/autenticacion';
import { Usuario } from '../../nucleo/modelos/usuario.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-navegacion',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navegacion.html',
  styleUrls: ['./navegacion.css']
})
export class NavegacionComponent implements OnInit, OnDestroy {
  usuarioActual: Usuario | null = null;
  private suscripcionUsuario!: Subscription;
  
  // Propiedad para contar ítems del carrito
  cantidadItemsCarrito: number = 0;
  private intervaloCarrito: any;

  constructor(
    public autenticacionService: AutenticacionService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.usuarioActual = this.autenticacionService.obtenerUsuarioActual();
    
    console.log('>>> USUARIO ACTUAL EN NAVEGACIÓN:', this.usuarioActual);

    this.suscripcionUsuario = this.autenticacionService.usuarioCambio$.subscribe(
      (usuario) => {
        console.log('>>> USUARIO CAMBIÓ A:', usuario);
        this.usuarioActual = usuario;
        this.actualizarContadorCarrito();
      }
    );

    this.actualizarContadorCarrito();

    // Sincronización en segundo plano con LocalStorage para actualizar la insignia en tiempo real
    this.intervaloCarrito = setInterval(() => {
      this.actualizarContadorCarrito();
    }, 1000);
  }

  actualizarContadorCarrito(): void {
    try {
      const carritoStr = localStorage.getItem('app_carrito_vuelos');
      const items = carritoStr ? JSON.parse(carritoStr) : [];
      const total = items.length;
      
      if (this.cantidadItemsCarrito !== total) {
        this.cantidadItemsCarrito = total;
        this.cdr.detectChanges();
      }
    } catch (e) {
      this.cantidadItemsCarrito = 0;
    }
  }

  get mostrarNavbar(): boolean {
    if (!this.usuarioActual) {
      return true;
    }
    return this.usuarioActual.rol !== 'ADMIN' && this.usuarioActual.rol !== 'ROOT';
  }

  cerrarSesion(): void {
    this.autenticacionService.cerrarSesion();
    this.router.navigate(['/inicio-sesion']);
  }

  ngOnDestroy(): void {
    if (this.suscripcionUsuario) {
      this.suscripcionUsuario.unsubscribe();
    }
    if (this.intervaloCarrito) {
      clearInterval(this.intervaloCarrito);
    }
  }
}