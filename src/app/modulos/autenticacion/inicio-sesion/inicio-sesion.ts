import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AutenticacionService } from '../../../nucleo/servicios/autenticacion';

@Component({
  selector: 'app-inicio-sesion',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './inicio-sesion.html',
  styleUrls: ['./inicio-sesion.css']
})
export class InicioSesionComponent {
  usuario: string = '';
  clave: string = '';
  mensajeError: string = '';

  constructor(
    private autenticacionService: AutenticacionService,
    private router: Router
  ) {}

alIngresar(): void {
  this.mensajeError = '';

    if (!this.usuario || !this.clave) {
      this.mensajeError = 'Por favor completa todos los campos.';
      return;
    }

    // Nos suscribimos a la petición asíncrona HTTP/JWT
    this.autenticacionService.iniciarSesion(this.usuario, this.clave).subscribe({
      next: (respuesta) => {
        // "respuesta.usuario" contiene el objeto con los datos y el ROL
        const usuarioLogueado = respuesta.usuario;

        if (usuarioLogueado.rol === 'ROOT') {
          window.location.href = '/gestion-administradores';
        } else if (usuarioLogueado.rol === 'ADMIN') {
          window.location.href = '/gestion-vuelos';
        } else {
          window.location.href = '/home';
        }
      },
      error: (err) => {
        console.error('Error en autenticación:', err);
        this.mensajeError = 'Usuario o contraseña incorrectos.';
      }
    });
  }
}