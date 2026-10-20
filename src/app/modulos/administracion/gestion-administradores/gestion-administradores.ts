import { Component, OnInit } from '@angular/core';
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

  nuevoAdmin: Usuario = {
    cc: 0,
    nombres: '',
    apellidos: '',
    email: '',
    username: '',
    password: '',
    rol: 'ADMIN'
  };

  constructor(
    private autenticacionService: AutenticacionService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.usuarioActual = this.autenticacionService.obtenerUsuarioActual();
    
    // Validación de seguridad para la consola Root[cite: 7]
    if (!this.usuarioActual || this.usuarioActual.rol !== 'ROOT') {
      alert('Acceso restringido únicamente para el usuario ROOT.');
      this.router.navigate(['/inicio-sesion']);
    } else {
      this.cargarAdministradores();
    }
  }

  cargarAdministradores(): void {
  // Pide al servicio que traiga los usuarios desde el backend
  this.autenticacionService.obtenerAdministradores().subscribe({
    next: (listaAdmins) => {
      this.administradores = listaAdmins;
    },
    error: (err) => {
      console.error('Error al cargar administradores:', err);
    }
  });
}

  toggleFormulario(): void {
    this.mostrarFormulario = !this.mostrarFormulario;
  }

  crearAdmin(): void {
  // Validación de campos requeridos 
  if (
    !this.nuevoAdmin.cc ||
    !this.nuevoAdmin.nombres ||
    !this.nuevoAdmin.apellidos ||
    !this.nuevoAdmin.email ||
    !this.nuevoAdmin.username ||
    !this.nuevoAdmin.password
  ) {
    alert('Por favor completa todos los campos del nuevo administrador.');
    return;
  }

  // Petición HTTP al backend
  this.autenticacionService.crearAdministrador(this.nuevoAdmin).subscribe({
    next: (adminCreado) => {
      alert('Administrador creado exitosamente.');
      
      // Limpiamos el formulario
      this.nuevoAdmin = { 
        cc: 0, 
        nombres: '', 
        apellidos: '', 
        email: '', 
        username: '', 
        password: '', 
        rol: 'ADMIN' 
      };
      
      this.mostrarFormulario = false;
      
      // Volvemos a consultar la lista actualizada desde la BD del backend
      this.cargarAdministradores();
    },
    error: (err) => {
      console.error('Error al crear administrador:', err);
      alert('Error: El nombre de usuario o correo ya existe.');
    }
  });
}

  eliminarAdmin(id?: number): void {
    if (!id) return;

  if (confirm('¿Estás seguro de que deseas eliminar a este administrador?')) {
    this.autenticacionService.eliminarAdministrador(id).subscribe({
      next: () => {
        alert('Administrador eliminado correctamente.');
        // Recargamos la lista desde el servidor para reflejar los cambios
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