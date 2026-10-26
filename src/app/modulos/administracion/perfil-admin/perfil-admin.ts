import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient, HttpBackend } from '@angular/common/http';
import { Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';

import { AutenticacionService } from '../../../nucleo/servicios/autenticacion';
import { Usuario } from '../../../nucleo/modelos/usuario.model';

@Component({
  selector: 'app-perfil-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './perfil-admin.html',
  styleUrls: ['./perfil-admin.css']
})
export class PerfilAdminComponent implements OnInit {
  // 1. Modelos de datos
  usuarioActual: Usuario | null = null;

  // 2. Estado de los campos editables
  emailEdit: string = '';
  direccionEdit: string = '';
  imagenPreview: string | null = null;
  passwordNueva: string = '';
  confirmarPassword: string = '';

  // 3. Estado de la interfaz y validaciones
  mensajeExito: string = '';
  mensajeError: string = '';
  fechaMinima: string = '';
  fechaMaxima: string = '';
  lugarValidado: string = '';

  // 4. Variables para la búsqueda reactiva
  lugares: string[] = [];
  buscadorLugares = new Subject<string>();

  constructor(
    private authService: AutenticacionService,
    private router: Router,
    private httpSinInterceptor: HttpClient,
    private cdr: ChangeDetectorRef,
    private handler: HttpBackend
  ) {
    this.httpSinInterceptor = new HttpClient(this.handler);
  }

  ngOnInit(): void {
    this.cargarDatosUsuario();
    this.configurarLimitesFecha();
    this.configurarBuscadorUbicaciones();
  }

  // --- CONFIGURACIONES INICIALES ---

  private configurarLimitesFecha(): void {
    const hoy = new Date();
    const max = new Date(hoy.getFullYear() - 18, hoy.getMonth(), hoy.getDate());
    const min = new Date(hoy.getFullYear() - 100, hoy.getMonth(), hoy.getDate());
    this.fechaMaxima = max.toISOString().split('T')[0];
    this.fechaMinima = min.toISOString().split('T')[0];
  }

  private configurarBuscadorUbicaciones(): void {
    this.buscadorLugares.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(texto => {
        if (texto.length < 3) return of([]);
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${texto}&count=5&language=es&format=json`;
        return this.httpSinInterceptor.get<any>(url).pipe(
          catchError(() => of({ results: [] }))
        );
      })
    ).subscribe(respuesta => {
      if (respuesta && respuesta.results) {
        this.lugares = respuesta.results.map((r: any) => {
          const partes = [r.name, r.admin1, r.country].filter(Boolean);
          return partes.join(', ');
        });
      } else {
        this.lugares = [];
      }
      this.cdr.detectChanges();
    });
  }

  // --- OBTENCIÓN DE DATOS ---

  cargarDatosUsuario(): void {
    this.usuarioActual = this.authService.obtenerUsuarioActual();

    if (!this.usuarioActual || !this.usuarioActual.id_usuario) {
      this.router.navigate(['/inicio-sesion']);
      return;
    }

    // Verificación de seguridad de rol
    if (this.usuarioActual.rol !== 'ADMIN' && this.usuarioActual.rol !== 'ROOT') {
      alert('Acceso permitido únicamente para administradores.');
      this.router.navigate(['/inicio-sesion']);
      return;
    }

    this.authService.obtenerPerfilUsuario(this.usuarioActual.id_usuario).subscribe({
      next: (usuarioMapeado) => {
        this.usuarioActual = {
          ...usuarioMapeado,
          cc: usuarioMapeado.cc || 0,
          nombres: usuarioMapeado.nombres || '',
          apellidos: usuarioMapeado.apellidos || '',
          usuario: usuarioMapeado.usuario || '',
          fechaNacimiento: usuarioMapeado.fechaNacimiento || '',
          lugarNacimiento: usuarioMapeado.lugarNacimiento || '',
          email: usuarioMapeado.email || ''
        };
        
        this.emailEdit = usuarioMapeado.email || '';
        this.direccionEdit = usuarioMapeado.direccionFacturacion || '';
        this.imagenPreview = usuarioMapeado.imagenUrl || null;
        
        this.lugarValidado = this.usuarioActual.lugarNacimiento || '';

        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al obtener perfil de administrador:', err);
        this.mensajeError = 'No se pudieron cargar los datos del perfil de administrador.';
        this.cdr.detectChanges();
      }
    });
  }

  // --- MANEJADORES DE EVENTOS DE LA VISTA ---

  alEscribirLugar(texto: string): void {
    if (texto !== this.lugarValidado) {
      this.lugarValidado = ''; 
    }
    this.buscadorLugares.next(texto);
  }

  seleccionarLugar(lugar: string): void {
    if (this.usuarioActual) {
      this.usuarioActual.lugarNacimiento = lugar;
    }
    this.lugarValidado = lugar; 
    this.lugares = []; 
  }

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

  // --- LÓGICA DE GUARDADO Y VALIDACIONES ---

  guardarCambios(): void {
    this.mensajeExito = '';
    this.mensajeError = '';

    if (!this.usuarioActual) return;

    // 1. Validación estricta de Nombres
    const nombresLimpios = (this.usuarioActual.nombres || '').trim();
    if (nombresLimpios === '') {
      this.mensajeError = 'El campo Nombres no puede estar vacío.';
      this.cdr.detectChanges();
      return;
    }

    // 2. Validación estricta de Apellidos
    const apellidosLimpios = (this.usuarioActual.apellidos || '').trim();
    if (apellidosLimpios === '') {
      this.mensajeError = 'El campo Apellidos no puede estar vacío.';
      this.cdr.detectChanges();
      return;
    }

    // 3. Validación estricta de Usuario
    const usuarioLimpio = (this.usuarioActual.usuario || '').trim();
    if (usuarioLimpio === '') {
      this.mensajeError = 'El nombre de usuario no puede estar vacío.';
      this.cdr.detectChanges();
      return;
    }
    if (usuarioLimpio.includes(' ')) {
      this.mensajeError = 'El nombre de usuario no puede contener espacios en blanco.';
      this.cdr.detectChanges();
      return;
    }

    // 4. Validación estricta de Dirección
    const direccionLimpiada = (this.direccionEdit || '').trim();
    if (direccionLimpiada === '') {
      this.mensajeError = 'La dirección no puede estar vacía.';
      this.cdr.detectChanges();
      return;
    }

    // 5. Validaciones heredadas de fecha y lugar
    if (!this.validarFechaNacimiento()) return;
    if (!this.validarLugarNacimiento()) return;

    // Construcción del payload con datos limpios
    const payloadBackend: Partial<Usuario> = {
      nombres: nombresLimpios,
      apellidos: apellidosLimpios,
      usuario: usuarioLimpio,
      fechaNacimiento: this.usuarioActual.fechaNacimiento,
      lugarNacimiento: this.usuarioActual.lugarNacimiento,
      genero: this.usuarioActual.genero,
      direccionFacturacion: direccionLimpiada,
      imagenUrl: this.imagenPreview || undefined
    };

    // 6. Validación estricta de Contraseñas
    const passRawNueva = this.passwordNueva || '';
    const passRawConf = this.confirmarPassword || '';

    if (passRawNueva.length > 0 || passRawConf.length > 0) {
      const passNuevaLimpia = passRawNueva.trim();
      const passConfLimpia = passRawConf.trim();

      if (passNuevaLimpia === '' || passConfLimpia === '') {
        this.mensajeError = 'La contraseña no puede estar vacía ni contener solo espacios en blanco.';
        this.cdr.detectChanges();
        return;
      }
      if (passNuevaLimpia === this.usuarioActual.password) {
        this.mensajeError = 'La nueva contraseña no puede ser igual a la anterior.';
        this.cdr.detectChanges();
        return;
      }
      if (passNuevaLimpia !== passConfLimpia) {
        this.mensajeError = 'Las contraseñas no coinciden.';
        this.cdr.detectChanges();
        return;
      }
      
      const regexPassword = /^(?=.*[a-zA-Z])(?=.*\d).{8,}$/;
      if (!regexPassword.test(passNuevaLimpia)) {
        this.mensajeError = 'Contraseña inválida. Debe tener mínimo 1 letra, 1 número y mínimo 8 caracteres.';
        this.cdr.detectChanges();
        return;
      }

      payloadBackend.password = passNuevaLimpia;
    }

    // 7. Petición HTTP al backend
    this.authService.actualizarPerfil(payloadBackend).subscribe({
      next: () => {
        this.passwordNueva = '';
        this.confirmarPassword = '';
        this.mensajeExito = 'Perfil de administrador actualizado con éxito';
        
        alert('¡Perfil de administrador actualizado con éxito!');
        
        this.cargarDatosUsuario(); 
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error detallado del servidor:', err);
        const mensajeBackend = err.error?.message;
        let textoError = '';

        if (Array.isArray(mensajeBackend)) {
          textoError = mensajeBackend[0].toLowerCase();
        } else if (typeof mensajeBackend === 'string') {
          textoError = mensajeBackend.toLowerCase();
        }

        if (err.status === 500 || textoError.includes('internal server error') || textoError.includes('duplicate') || textoError.includes('unique')) {
          this.mensajeError = 'Ese nombre de usuario ya existe en el sistema.';
        } else if (textoError.includes('password') || textoError.includes('contraseña')) {
          this.mensajeError = 'Contraseña inválida. Debe tener mínimo 1 letra, 1 número y mínimo 8 caracteres.';
        } else {
          this.mensajeError = Array.isArray(mensajeBackend) ? mensajeBackend[0] : (mensajeBackend || 'Error al guardar los cambios del administrador.');
        }

        this.cdr.detectChanges();
      }
    });
  }

  cancelar(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    this.passwordNueva = '';
    this.confirmarPassword = '';
    this.mensajeError = '';
    this.mensajeExito = '';

    // Navegación limpia hacia la vista de administración
    this.router.navigateByUrl('/gestion-vuelos');
  }

  // --- FUNCIONES AUXILIARES DE VALIDACIÓN ---

  private validarFechaNacimiento(): boolean {
    if (!this.usuarioActual) return false;
    const fechaStr = this.usuarioActual.fechaNacimiento || '';

    // Si no han seleccionado/cambiado fecha, dejamos continuar con los demás campos
    if (!fechaStr) {
      return true;
    }

    const fechaParseada = new Date(fechaStr);
    if (isNaN(fechaParseada.getTime()) || !this.validarMayorDeEdad(fechaStr)) {
      this.mensajeError = 'Fecha inválida: Debe ser mayor de edad.';
      this.cdr.detectChanges();
      return false;
    }

    return true;
  }

  private validarLugarNacimiento(): boolean {
    if (!this.usuarioActual) return false;
    if (!this.lugarValidado || this.usuarioActual.lugarNacimiento !== this.lugarValidado) {
      this.mensajeError = 'Debes seleccionar una ciudad válida de la lista autocompletada.';
      return false;
    }
    return true;
  }

  private validarMayorDeEdad(fechaNacimientoStr: string): boolean {
    const fechaNacimiento = new Date(fechaNacimientoStr);
    const hoy = new Date();
    let edad = hoy.getFullYear() - fechaNacimiento.getFullYear();
    const mes = hoy.getMonth() - fechaNacimiento.getMonth();

    if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNacimiento.getDate())) {
      edad--;
    }
    return edad >= 18 && edad <= 100;
  }
}