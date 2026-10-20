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

    if (!this.usuarioActual) {
      this.router.navigate(['/inicio-sesion']);
      return;
    }

    // Inicializar campos con datos actuales del usuario
    this.emailEdit = this.usuarioActual.correo || '';
    this.direccionEdit = this.usuarioActual.direccionFacturacion || '';
    this.suscritoNoticiasEdit = !!this.usuarioActual.suscritoNoticias;
    this.imagenPreview = this.usuarioActual.imagenUrl || null;
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
    this.mensajeExito = '';
    this.mensajeError = '';

    if (!this.usuarioActual) return;

    // 1. Validaciones básicas de campos vacíos
    if (!this.emailEdit.trim()) {
      this.mensajeError = 'El correo electrónico no puede estar vacío.';
      return;
    }

    if (!this.direccionEdit.trim()) {
      this.mensajeError = 'La dirección de facturación no puede estar vacía.';
      return;
    }

    // 2. Validaciones de Contraseña
    if (this.passwordNueva.trim() !== '') {
      // Regla A: Que sea diferente a la contraseña actual
      if (this.passwordNueva === this.usuarioActual.password) {
        this.mensajeError = 'La nueva contraseña no puede ser igual a la contraseña anterior.';
        return;
      }

      // Regla B: Que coincida con la confirmación
      if (this.passwordNueva !== this.confirmarPassword) {
        this.mensajeError = 'La nueva contraseña y la confirmación no coinciden.';
        return;
      }
    }

    // 3. Crear el objeto con los datos actualizados
    const usuarioActualizado: Usuario = {
      ...this.usuarioActual,
      correo: this.emailEdit,
      direccionFacturacion: this.direccionEdit,
      suscritoNoticias: this.suscritoNoticiasEdit,
      imagenUrl: this.imagenPreview || undefined
    };

    if (this.passwordNueva.trim() !== '') {
      usuarioActualizado.password = this.passwordNueva;
    }

    // 4. Petición HTTP al Backend
    this.authService.actualizarPerfil(usuarioActualizado).subscribe({
      next: (usuarioResp) => {
        // El servidor respondió con éxito y nos devolvió los datos actualizados
        this.usuarioActual = usuarioResp; 
        this.passwordNueva = '';
        this.confirmarPassword = '';
        this.mensajeExito = '¡Perfil actualizado exitosamente!';
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