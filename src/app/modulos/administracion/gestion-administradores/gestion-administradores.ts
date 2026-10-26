import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AutenticacionService } from '../../../nucleo/servicios/autenticacion';
import { Usuario } from '../../../nucleo/modelos/usuario.model';

@Component({
  selector: 'app-gestion-administradores',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './gestion-administradores.html',
  styleUrls: ['./gestion-administradores.css']
})
export class GestionAdministradoresComponent implements OnInit {
  administradores: Usuario[] = [];
  mostrarFormulario: boolean = false;
  usuarioActual: Usuario | null = null;

  nuevoAdmin: Partial<Usuario> = {
    cc: 0,
    usuario: '',
    email: '',
    rol: 'ADMIN'
  };

  constructor(
    private autenticacionService: AutenticacionService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.usuarioActual = this.autenticacionService.obtenerUsuarioActual();
    
    // Validación de seguridad para la consola Root
    if (!this.usuarioActual || this.usuarioActual.rol !== 'ROOT') {
      alert('Acceso restringido únicamente para el usuario ROOT.');
      this.router.navigate(['/inicio-sesion']);
    } else {
      this.cargarAdministradores();
    }
  }

  cargarAdministradores(): void {
    this.autenticacionService.obtenerAdministradores().subscribe({
      next: (listaAdmins) => {
        console.log('Datos reales del backend:', listaAdmins);
        this.administradores = listaAdmins;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar administradores:', err);
      }
    });
  }

  toggleFormulario(): void {
    this.mostrarFormulario = !this.mostrarFormulario;
    if (!this.mostrarFormulario) {
      this.limpiarFormulario();
    }
  }

  crearAdmin(): void {
    const ccStr = String(this.nuevoAdmin.cc || '').trim();
    const usuarioLimpio = (this.nuevoAdmin.usuario || '').trim();
    const emailLimpio = (this.nuevoAdmin.email || '').trim();

    // 1. Campos obligatorios
    if (!ccStr || ccStr === '0' || usuarioLimpio === '' || emailLimpio === '') {
      alert('Por favor completa todos los campos requeridos.');
      return;
    }

    // 2. Validación de Cédula / Documento (Longitud de 8 a 10 dígitos)
    const regexCedula = /^\d{8,10}$/;
    if (!regexCedula.test(ccStr)) {
      alert('Cédula inválida. Longitud de 8 a 10 dígitos.');
      return;
    }

    // 3. Validación de Correo Electrónico
    const regexEmail = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!regexEmail.test(emailLimpio)) {
      alert('Correo electrónico inválido.');
      return;
    }

    if (usuarioLimpio.includes(' ')) {
      alert('El nombre de usuario no puede contener espacios.');
      return;
    }

    // 4. Construcción de la contraseña provisional (Documento + Usuario)
    const claveProvisional = `${ccStr}${usuarioLimpio}`;

    // Validación de seguridad para la contraseña antes de enviar al backend
    if (claveProvisional.length < 8) {
      alert('La combinación de Cédula y Nombre de Usuario genera una contraseña demasiado corta. Debe sumar al menos 8 caracteres.');
      return;
    }

    const payloadAdmin: Partial<Usuario> = {
      cc: Number(ccStr),
      usuario: usuarioLimpio,
      email: emailLimpio,
      password: claveProvisional,
      rol: 'ADMIN'
    };

    // 5. Petición HTTP al backend
    this.autenticacionService.crearAdministrador(payloadAdmin as Usuario).subscribe({
      next: () => {
        alert(`Administrador creado exitosamente. Su contraseña inicial es: ${claveProvisional}`);
        this.limpiarFormulario();
        this.mostrarFormulario = false;
        this.cargarAdministradores();
      },
      error: (err) => {
        console.error('Error al crear administrador:', err);
        const msj = err.error?.message;
        const textoError = Array.isArray(msj) ? msj[0] : (msj || 'El nombre de usuario o correo ya existe.');
        alert(`Error: ${textoError}`);
      }
    });
  }

  limpiarFormulario(): void {
    this.nuevoAdmin = {
      cc: 0,
      usuario: '',
      email: '',
      rol: 'ADMIN'
    };
  }

  eliminarAdmin(id?: number): void {
    if (!id) return;

    if (confirm('¿Estás seguro de que deseas eliminar a este administrador?')) {
      this.autenticacionService.eliminarAdministrador(id).subscribe({
        next: () => {
          alert('Administrador eliminado correctamente.');
          this.cargarAdministradores();
        },
        error: (err) => {
          console.error('Error al eliminar administrador:', err);
          alert('No se pudo eliminar el administrador.');
        }
      });
    }
  }

  cerrarSesion(): void {
    this.autenticacionService.cerrarSesion();
    this.router.navigate(['/inicio-sesion']);
  }
}