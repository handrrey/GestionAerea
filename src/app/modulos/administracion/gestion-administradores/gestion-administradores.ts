import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
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
  mensajeErrorFormulario: string = '';

  private apiUrl = 'http://localhost:3000/appV1';

  nuevoAdmin: Partial<Usuario> = {
    cc: 0,
    usuario: '',
    email: '',
    rol: 'ADMIN'
  };

  constructor(
    private autenticacionService: AutenticacionService,
    private http: HttpClient,
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
    this.mensajeErrorFormulario = '';
    if (!this.mostrarFormulario) {
      this.limpiarFormulario();
    }
  }

  crearAdmin(): void {
    this.mensajeErrorFormulario = '';

    const ccStr = String(this.nuevoAdmin.cc || '').trim();
    const usuarioLimpio = (this.nuevoAdmin.usuario || '').trim();
    const emailLimpio = (this.nuevoAdmin.email || '').trim();

    // 1. Campos obligatorios
    if (!ccStr || ccStr === '0' || usuarioLimpio === '' || emailLimpio === '') {
      this.mensajeErrorFormulario = 'Por favor completa todos los campos requeridos.';
      return;
    }

    // 2. Validación de Cédula / Documento (Longitud de 8 a 10 dígitos)
    const regexCedula = /^\d{8,10}$/;
    if (!regexCedula.test(ccStr)) {
      this.mensajeErrorFormulario = 'Cédula inválida. Debe tener entre 8 y 10 dígitos.';
      return;
    }

    // 3. Validación de Nombre de Usuario (letras, números y guion bajo _)
    const regexUsuario = /^[a-zA-Z0-9_]+$/;
    if (!regexUsuario.test(usuarioLimpio)) {
      this.mensajeErrorFormulario = 'El nombre de usuario solo puede contener letras, números y guion bajo (_), sin espacios.';
      return;
    }

    // 4. Validación de Correo Electrónico
    const regexEmail = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!regexEmail.test(emailLimpio)) {
      this.mensajeErrorFormulario = 'Correo electrónico inválido.';
      return;
    }

    // 5. Construcción de la contraseña provisional (Documento + Usuario)
    const claveProvisional = `${ccStr}${usuarioLimpio}`;

    if (claveProvisional.length < 8) {
      this.mensajeErrorFormulario = 'La combinación de Cédula y Nombre de Usuario debe sumar al menos 8 caracteres.';
      return;
    }

    // 6. Verificar primero en los administradores cargados localmente
    const adminExistente = this.administradores.find(
      (a: any) => String(a.cc || a.documento || '').trim() === ccStr
    );
    if (adminExistente) {
      const rolEncontrado = String(adminExistente.rol || 'ADMIN').toUpperCase();
      this.mensajeErrorFormulario = `Cédula ${ccStr} ya pertenece a un usuario ${rolEncontrado}.`;
      alert(this.mensajeErrorFormulario);
      return;
    }

    // 7. Consultar todos los usuarios del sistema (CLIENTE / ADMIN / ROOT) para validar CC duplicada
    this.http.get<any>(`${this.apiUrl}/usuarios`).pipe(
      catchError(() => this.http.get<any>(`${this.apiUrl}/auth/usuarios`).pipe(catchError(() => of([]))))
    ).subscribe((resUsuarios: any) => {
      const listaUsuarios = Array.isArray(resUsuarios)
        ? resUsuarios
        : (resUsuarios?.usuarios || resUsuarios?.data || []);

      const usuarioConMismaCC = listaUsuarios.find(
        (u: any) => String(u.cc || u.documento || u.dni || '').trim() === ccStr
      );

      if (usuarioConMismaCC) {
        const rolEncontrado = String(usuarioConMismaCC.rol || 'CLIENTE').toUpperCase();
        this.mensajeErrorFormulario = `Cédula ${ccStr} ya pertenece a un usuario ${rolEncontrado}.`;
        alert(this.mensajeErrorFormulario);
        this.cdr.detectChanges();
        return;
      }

      // 8. Si la cédula está libre, enviar petición de creación al backend
      const payloadAdmin: Partial<Usuario> = {
        cc: Number(ccStr),
        usuario: usuarioLimpio,
        email: emailLimpio,
        password: claveProvisional,
        rol: 'ADMIN'
      };

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
          const textoError = Array.isArray(msj) ? msj[0] : (msj || 'El nombre de usuario, cédula o correo ya existe.');
          this.mensajeErrorFormulario = textoError;
          alert(`Error: ${textoError}`);
          this.cdr.detectChanges();
        }
      });
    });
  }

  limpiarFormulario(): void {
    this.mensajeErrorFormulario = '';
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