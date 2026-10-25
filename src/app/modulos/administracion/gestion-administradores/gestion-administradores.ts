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
    const ccNumero = Number(this.nuevoAdmin.cc);
    const usuarioLimpio = (this.nuevoAdmin.usuario || '').trim();
    const emailLimpio = (this.nuevoAdmin.email || '').trim();

    // 1. Validación de campos requeridos
    if (!ccNumero || ccNumero <= 0 || usuarioLimpio === '' || emailLimpio === '') {
      alert('Por favor completa el Documento (CC), Usuario y Correo Electrónico.');
      return;
    }

    if (usuarioLimpio.includes(' ')) {
      alert('El nombre de usuario no puede contener espacios.');
      return;
    }

    // 2. Asignamos la contraseña por defecto usando el número de documento/CC
    const payloadAdmin: Partial<Usuario> = {
      cc: ccNumero,
      usuario: usuarioLimpio,
      email: emailLimpio,
      password: String(ccNumero), // 🟢 Contraseña inicial = Número de Documento
      rol: 'ADMIN'
    };

    // 3. Petición HTTP al backend
    this.autenticacionService.crearAdministrador(payloadAdmin as Usuario).subscribe({
      next: () => {
        alert('Administrador creado exitosamente. Su contraseña inicial es su número de documento.');
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