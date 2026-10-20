import { Component, OnInit, OnDestroy } from '@angular/core';
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

  constructor(
    public autenticacionService: AutenticacionService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.usuarioActual = this.autenticacionService.obtenerUsuarioActual();
    
    // LOG DE CONTROL: Abre F12 -> Consola para ver qué sale aquí al recargar /home
    console.log('>>> USUARIO ACTUAL EN NAVEGACIÓN:', this.usuarioActual);

    this.suscripcionUsuario = this.autenticacionService.usuarioCambio$.subscribe(
      (usuario) => {
        console.log('>>> USUARIO CAMBIÓ A:', usuario);
        this.usuarioActual = usuario;
      }
    );
  }

  get mostrarNavbar(): boolean {
    if (!this.usuarioActual) {
      return true; // Para visitantes / sin sesión debe ser true
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
  }
}