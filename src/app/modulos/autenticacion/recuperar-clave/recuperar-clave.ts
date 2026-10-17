import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AutenticacionService } from '../../../nucleo/servicios/autenticacion';

@Component({
  selector: 'app-recuperar-clave',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './recuperar-clave.html',
  styleUrls: ['./recuperar-clave.css']
})
export class RecuperarClaveComponent {
  email: string = '';
  mensajeExito: string = '';
  mensajeError: string = '';

  constructor(
    private autenticacionService: AutenticacionService,
    private router: Router
  ) {}

  alEnviar(): void {
    this.mensajeExito = '';
    this.mensajeError = '';

    // 1. Validación local del campo
    if (!this.email) {
      this.mensajeError = 'Por favor ingresa tu correo electrónico.';
      return;
    }

    // 2. Petición asíncrona al Backend
    this.autenticacionService.recuperarClave(this.email).subscribe({
      next: (respuesta) => {
        // ÉXITO: El servidor procesó la solicitud
        this.mensajeExito = 'Te hemos enviado un enlace de recuperación a tu correo electrónico.';
      },
      error: (err) => {
        // Por buenas prácticas de seguridad OWASP, muchas aplicaciones muestran un mensaje neutro
        // o capturan el error si el correo no existe en la base de datos
        if (err.status === 404) {
          this.mensajeError = 'El correo electrónico ingresado no se encuentra registrado.';
        } else {
          // Mensaje genérico de éxito/seguridad si el backend maneja respuesta ciega
          this.mensajeExito = 'Si el correo está registrado en nuestro sistema, recibirás las instrucciones en breve.';
        }
      }
    });
  }
}