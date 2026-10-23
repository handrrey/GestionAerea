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

  nuevoAdmin: Usuario = {
    cc: 0,
    nombres: '',
    apellidos: '',
    email: '',
    usuario: '',
    password: '',
    rol: 'ADMIN',
    fechaNacimiento: '',
  };

  fechaMinima: string = '';
  fechaMaxima: string = '';

  constructor(
    private autenticacionService: AutenticacionService,
    private router: Router,
    private cdr: ChangeDetectorRef
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

    // Validación de fechas para el formulario de creación de administradores
    const hoy = new Date();

    // Límite máximo: Hace exactamente 18 años (para bloquear a los menores de edad)
    const max = new Date(hoy.getFullYear() - 18, hoy.getMonth(), hoy.getDate());
    
    // Límite mínimo: Hace exactamente 100 años (para bloquear edades irreales)
    const min = new Date(hoy.getFullYear() - 100, hoy.getMonth(), hoy.getDate());

    // Convertimos las fechas al formato YYYY-MM-DD que requiere el input HTML
    this.fechaMaxima = max.toISOString().split('T')[0];
    this.fechaMinima = min.toISOString().split('T')[0];
  
  }

  cargarAdministradores(): void {
  // Pide al servicio que traiga los usuarios desde el backend
  this.autenticacionService.obtenerAdministradores().subscribe({
    next: (listaAdmins) => {
      console.log('Datos reales del backend:', listaAdmins); // Prueba para ver listaAdmins
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
  }

  crearAdmin(): void {
  // Validación de campos requeridos 
  if (
    !this.nuevoAdmin.cc ||
    !this.nuevoAdmin.nombres ||
    !this.nuevoAdmin.apellidos ||
    !this.nuevoAdmin.email ||
    !this.nuevoAdmin.usuario ||
    !this.nuevoAdmin.password ||
    !this.nuevoAdmin.fechaNacimiento
  ) {
    alert('Por favor completa todos los campos del nuevo administrador.');
    return;
  }

  // Validación de mayoría de edad
  if (!this.nuevoAdmin.fechaNacimiento) {
    alert('Por favor ingresa la fecha de nacimiento.');
    return;
  }
  if (!this.validarMayorDeEdad(this.nuevoAdmin.fechaNacimiento)) {
    alert('El administrador debe ser mayor de 18 años.');
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
        usuario: '',
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

  validarMayorDeEdad(fechaNacimientoStr: string): boolean {
    const fechaNacimiento = new Date(fechaNacimientoStr);
    const hoy = new Date();
  
    let edad = hoy.getFullYear() - fechaNacimiento.getFullYear();
    const mes = hoy.getMonth() - fechaNacimiento.getMonth();
  
    if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNacimiento.getDate())) {
      edad--;
    }
  
    return edad >= 18;
  }
}