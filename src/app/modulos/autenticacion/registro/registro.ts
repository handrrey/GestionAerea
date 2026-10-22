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
    usuario: '',
    password: '',
    imagenUrl: '',
    rol: 'CLIENTE',
    //suscritoNoticias: false
  };

  mensajeError: string = '';
  fechaMinima: string = '';
  fechaMaxima: string = '';

  constructor(
    private autenticacionService: AutenticacionService,
    private router: Router
  ) {}
  
  ngOnInit(): void {
    const hoy = new Date();

    // Límite máximo: Hace exactamente 18 años (para bloquear a los menores de edad)
    const max = new Date(hoy.getFullYear() - 18, hoy.getMonth(), hoy.getDate());
    
    // Límite mínimo: Hace exactamente 100 años (para bloquear edades irreales)
    const min = new Date(hoy.getFullYear() - 100, hoy.getMonth(), hoy.getDate());

    // Convertimos las fechas al formato YYYY-MM-DD que requiere el input HTML
    this.fechaMaxima = max.toISOString().split('T')[0];
    this.fechaMinima = min.toISOString().split('T')[0];
  }

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
      !this.nuevoUsuario.usuario ||
      !this.nuevoUsuario.password
    ) {
      this.mensajeError = 'Por favor completa todos los campos obligatorios.';
      return;
    }

    // Validación de mayoría de edad
    if (!this.nuevoUsuario.fechaNacimiento) {
      this.mensajeError = 'Por favor ingresa tu fecha de nacimiento.';
      return;
    }
    if (!this.validarMayorDeEdad(this.nuevoUsuario.fechaNacimiento)) {
      this.mensajeError = 'Debes ser mayor de 18 años para poder registrarte.';
      return; // Esto detiene la ejecución para que no consulte al backend
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

  validarMayorDeEdad(fechaNacimientoStr: string): boolean {
    const fechaNacimiento = new Date(fechaNacimientoStr);
    const hoy = new Date();
  
    let edad = hoy.getFullYear() - fechaNacimiento.getFullYear();
    const mes = hoy.getMonth() - fechaNacimiento.getMonth();
  
    // Si el mes es menor, o es el mismo mes pero el día es menor, aún no ha cumplido años este año
    if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNacimiento.getDate())) {
      edad--;
    }
  
  return edad >= 18;
  }
}