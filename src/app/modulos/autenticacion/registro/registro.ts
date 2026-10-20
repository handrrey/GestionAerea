import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AutenticacionService } from '../../../nucleo/servicios/autenticacion';
import { Usuario } from '../../../nucleo/modelos/usuario.model';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './registro.html',
  styleUrls: ['./registro.css']
})
export class RegistroComponent {
  nuevoUsuario: Usuario = {
    cc: 0,
    nombres: '',
    apellidos: '',
    fechaNacimiento: '',
    lugarNacimiento: '',
    direccionFacturacion: '',
    genero: '',
    email: '',
    username: '',
    password: '',
    imagenUrl: '',
    rol: 'CLIENTE',
    //suscritoNoticias: false
  };

  mensajeError: string = '';

  constructor(
    private autenticacionService: AutenticacionService,
    private router: Router
  ) {}

  // Manejador para la selección de imagen de perfil (convierte a Base64)
  alSeleccionarImagen(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        this.nuevoUsuario.imagenUrl = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  alRegistrar(): void {
    this.mensajeError = '';

    // 1. Validación local rápida de campos obligatorios 
    if (
      !this.nuevoUsuario.cc ||
      !this.nuevoUsuario.nombres ||
      !this.nuevoUsuario.apellidos ||
      !this.nuevoUsuario.email ||
      !this.nuevoUsuario.username ||
      !this.nuevoUsuario.password
    ) {
      this.mensajeError = 'Por favor completa todos los campos obligatorios.';
      return;
    }

    // 2. Petición asíncrona al Backend mediante .subscribe()
    this.autenticacionService.registrarCliente(this.nuevoUsuario).subscribe({
      next: (usuarioCreado) => {
        // EXITO: El backend guardó al usuario en la BD
        alert('¡Cuenta creada exitosamente! Ya puedes iniciar sesión.');
        this.router.navigate(['/inicio-sesion']);
      },
      error: (err) => {
        // ERROR: El usuario/correo ya existe o falló el servidor
        console.error('Error en el registro:', err);
        this.mensajeError = 'El nombre de usuario o correo ya se encuentra registrado.';
      }
    });
  }
}