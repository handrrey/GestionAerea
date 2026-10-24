import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';

import { AutenticacionService } from '../../../nucleo/servicios/autenticacion';
import { Usuario } from '../../../nucleo/modelos/usuario.model';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './registro.html',
  styleUrls: ['./registro.css']
})
export class RegistroComponent implements OnInit {
  // 1. Modelos de datos
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
  };

  // 2. Estado de la interfaz y validaciones
  mensajeError: string = '';
  fechaMinima: string = '';
  fechaMaxima: string = '';
  lugarValidado: string = ''; 

  // 3. Variables para la búsqueda reactiva
  lugares: string[] = [];
  buscadorLugares = new Subject<string>();

  constructor(
    private autenticacionService: AutenticacionService,
    private router: Router,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
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
        return this.http.get<any>(url).pipe(
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

  // --- MANEJADORES DE EVENTOS DE LA VISTA ---

  alEscribirLugar(texto: string): void {
    if (texto !== this.lugarValidado) {
      this.lugarValidado = ''; 
    }
    this.buscadorLugares.next(texto);
  }

  seleccionarLugar(lugar: string): void {
    this.nuevoUsuario.lugarNacimiento = lugar;
    this.lugarValidado = lugar; 
    this.lugares = []; 
  }

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

    if (!this.validarCamposObligatorios()) return;
    if (!this.validarCedula()) return;
    if (!this.validarFechaNacimiento()) return;
    if (!this.validarLugarNacimiento()) return;

    this.autenticacionService.registrarCliente(this.nuevoUsuario).subscribe({
      next: () => {
        alert('¡Cuenta creada exitosamente! Ya puedes iniciar sesión.');
        this.router.navigate(['/inicio-sesion']);
      },
      error: (err) => {
        console.error('Error en el registro:', err);
        
        const mensajeBackend = err.error?.message;
        let textoError = '';

        if (Array.isArray(mensajeBackend)) {
          textoError = mensajeBackend[0].toLowerCase();
        } else if (typeof mensajeBackend === 'string') {
          textoError = mensajeBackend.toLowerCase();
        }

        if (textoError.includes('email') || textoError.includes('correo')) {
          this.mensajeError = 'Correo electronico invalido.';
        } else {
          this.mensajeError = 'El nombre de usuario o correo ya se encuentra registrado.';
        }

        this.cdr.detectChanges();
      }
    });
  }

  // --- FUNCIONES AUXILIARES DE VALIDACIÓN ---

  private validarCamposObligatorios(): boolean {
    if (
      !this.nuevoUsuario.cc || !this.nuevoUsuario.nombres ||
      !this.nuevoUsuario.apellidos || !this.nuevoUsuario.fechaNacimiento ||
      !this.nuevoUsuario.lugarNacimiento || !this.nuevoUsuario.email ||
      !this.nuevoUsuario.usuario || !this.nuevoUsuario.password
    ) {
      this.mensajeError = 'Por favor completa todos los campos obligatorios.';
      return false;
    }
    return true;
  }

  private validarCedula(): boolean {
    const ccString = String(this.nuevoUsuario.cc || '');
    if (ccString.length < 8 || ccString.length > 10) {
      this.mensajeError = 'Cedula invalida. Longitud de 8 a 10 digitos';
      return false;
    }
    return true;
  }

  private validarFechaNacimiento(): boolean {
    const fechaStr = this.nuevoUsuario.fechaNacimiento || ''; 
    const fechaParseada = new Date(fechaStr);

    if (
      !this.nuevoUsuario.fechaNacimiento || isNaN(fechaParseada.getTime()) ||
      !this.validarMayorDeEdad(this.nuevoUsuario.fechaNacimiento)
    ) {
      this.mensajeError = 'Fecha invalida: Fecha sin sentido o menor de edad.';
      return false;
    }
    return true;
  }

  private validarLugarNacimiento(): boolean {
    if (!this.lugarValidado || this.nuevoUsuario.lugarNacimiento !== this.lugarValidado) {
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