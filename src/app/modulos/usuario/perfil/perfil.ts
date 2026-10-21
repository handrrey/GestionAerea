import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AutenticacionService } from '../../../nucleo/servicios/autenticacion';
import { Usuario } from '../../../nucleo/modelos/usuario.model';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './perfil.html',
  styleUrls: ['./perfil.css']
})
export class PerfilComponent implements OnInit {
  usuarioActual: Usuario | null = null;

  // Campos Editables
  emailEdit: string = '';
  direccionEdit: string = '';
  suscritoNoticiasEdit: boolean = false;
  imagenPreview: string | null = null;

  // Contraseñas
  passwordNueva: string = '';
  confirmarPassword: string = '';

  // Mensajes de feedback
  mensajeExito: string = '';
  mensajeError: string = '';

  constructor(
    private authService: AutenticacionService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.cargarDatosUsuario();
  }

  cargarDatosUsuario(): void {
    this.usuarioActual = this.authService.obtenerUsuarioActual();

    if (!this.usuarioActual || !this.usuarioActual.id_usuario) {
      this.router.navigate(['/inicio-sesion']);
      return;
    }

    // Petición HTTP al backend
    this.authService.obtenerPerfilUsuario(this.usuarioActual.id_usuario).subscribe({
      next: (usuarioMapeado) => {
        this.usuarioActual = usuarioMapeado;

        // 2. Asignamos los campos editables usando el objeto recién mapeado
        this.emailEdit = usuarioMapeado.email || '';
        this.direccionEdit = usuarioMapeado.direccionFacturacion || '';
        this.imagenPreview = usuarioMapeado.imagenUrl || null;
      },
      error: (err) => {
        console.error('Error al obtener perfil completo:', err);
        this.mensajeError = 'No se pudieron cargar los datos del usuario.';
      }
    });
  }

  // Cargar foto de perfil e instanciar previsualización
  onFotoSeleccionada(event: Event): void {
    const fileInput = event.target as HTMLInputElement;
    if (fileInput.files && fileInput.files[0]) {
      const archivo = fileInput.files[0];

      if (!archivo.type.startsWith('image/')) {
        this.mensajeError = 'Por favor selecciona un archivo de imagen válido.';
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        this.imagenPreview = reader.result as string;
      };
      reader.readAsDataURL(archivo);
    }
  }

  guardarCambios(): void {
    this.mensajeExito = '¡Perfil actualizado con éxito!';
    this.mensajeError = '';

    if (!this.usuarioActual) return;

    if (!this.emailEdit.trim()) {
      this.mensajeError = 'El correo electrónico no puede estar vacío.';
      return;
    }

    if (!this.direccionEdit.trim()) {
      this.mensajeError = 'La dirección de facturación no puede estar vacía.';
      return;
    }

    // Construimos el payload adaptado a lo que espera NestJS
    const payloadBackend: Partial<Usuario> = {
      email: this.emailEdit,
      //suscritoNoticias: this.suscritoNoticiasEdit,
      direccionFacturacion: this.direccionEdit,
      imagenUrl: this.imagenPreview || undefined
    };

    if (this.passwordNueva.trim() !== '') {
      if (this.passwordNueva === this.usuarioActual.password) {
        this.mensajeError = 'La nueva contraseña no puede ser igual a la anterior.';
        return;
      }
      if (this.passwordNueva !== this.confirmarPassword) {
        this.mensajeError = 'Las contraseñas no coinciden.';
        return;
      }
      payloadBackend.password = this.passwordNueva;
    }

    this.authService.actualizarPerfil(payloadBackend).subscribe({
      next: (usuarioResp) => {
        this.passwordNueva = '';
        this.confirmarPassword = '';
        this.mensajeExito = '¡Perfil actualizado exitosamente!';
        this.cargarDatosUsuario(); // Recargamos datos actualizados
      },
      error: (err) => {
        console.error('Error al actualizar perfil:', err);
        this.mensajeError = 'Hubo un error al guardar los datos en el servidor.';
      }
    });
  }

  cancelar(): void {
    this.cargarDatosUsuario();
    this.passwordNueva = '';
    this.confirmarPassword = '';
    this.mensajeError = '';
    this.mensajeExito = '';
    this.router.navigate(['/home']);
  }
}