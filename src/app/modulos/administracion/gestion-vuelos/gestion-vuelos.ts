import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AutenticacionService } from '../../../nucleo/servicios/autenticacion';
import { VuelosService } from '../../../nucleo/servicios/vuelos';
import { Usuario } from '../../../nucleo/modelos/usuario.model';
import { Vuelo } from '../../../nucleo/modelos/vuelos.model';

@Component({
  selector: 'app-gestion-vuelos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './gestion-vuelos.html',
  styleUrls: ['./gestion-vuelos.css']
})
export class GestionVuelosComponent implements OnInit {

  usuarioActual: Usuario | null = null;
  vuelos: Vuelo[] = [];
  
  ciudadesOrigen: string[] = [
    'Pereira (PEI)', 'Bogotá (BOG)', 'Medellín (MDE)', 'Cali (CLO)', 'Cartagena (CTG)'
  ];

  ciudadesDestino: string[] = [
    'Pereira (PEI)', 'Bogotá (BOG)', 'Medellín (MDE)', 'Cartagena (CTG)',
    'Cali (CLO)', 'Miami (MIA)', 'Madrid (MAD)', 'Londres (LON)',
    'Nueva York (NYC)', 'Buenos Aires (BUE)'
  ];

  private duracionesMinutos: { [clave: string]: number } = {
    'PEI-BOG': 55,  'PEI-MDE': 45,  'PEI-CLO': 45,  'PEI-CTG': 80,
    'PEI-MIA': 230, 'PEI-MAD': 600, 'PEI-LON': 630, 'PEI-NYC': 340, 'PEI-BUE': 380,

    'BOG-MDE': 60,  'BOG-CLO': 60,  'BOG-CTG': 85,  'BOG-PEI': 55,
    'BOG-MIA': 220, 'BOG-MAD': 580, 'BOG-LON': 615, 'BOG-NYC': 330, 'BOG-BUE': 375,

    'MDE-CLO': 60,  'MDE-CTG': 75,  'MDE-BOG': 60,  'MDE-PEI': 45,
    'MDE-MIA': 225, 'MDE-MAD': 590, 'MDE-LON': 625, 'MDE-NYC': 335, 'MDE-BUE': 385,

    'CLO-CTG': 100, 'CLO-BOG': 60,  'CLO-MDE': 60,  'CLO-PEI': 45,
    'CLO-MIA': 235, 'CLO-MAD': 600, 'CLO-LON': 635, 'CLO-NYC': 345, 'CLO-BUE': 370,

    'CTG-BOG': 85,  'CTG-MDE': 75,  'CTG-CLO': 100, 'CTG-PEI': 80,
    'CTG-MIA': 170, 'CTG-MAD': 570, 'CTG-LON': 600, 'CTG-NYC': 290, 'CTG-BUE': 430
  };

  mostrarModal: boolean = false;
  editando: boolean = false;
  vueloForm: Vuelo = this.obtenerVueloVacio();

  // Control para desplegar los errores en el modal
  mensajeErrorModal: string = '';

  promocionesActivasCount: number = 3;
  mensajesSinResponderCount: number = 5;

  constructor(
    private authService: AutenticacionService,
    private vuelosService: VuelosService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.usuarioActual = this.authService.obtenerUsuarioActual();
    this.cargarVuelos(); 
  }

  cargarVuelos(): void {
    this.vuelosService.obtenerVuelos().subscribe({
      next: (datosBackend: any[]) => {
        this.vuelos = (datosBackend || []).map(v => ({
          ...v,
          id: v.idVuelo || v.id || 0,
          codigo: v.codigoVuelo || v.codigo || '',
          origen: v.origen || '',
          destino: v.destino || '',
          fecha: v.fechaVuelo || v.fecha || '',
          horaVuelo: v.horaVuelo || '',
          duracionVuelo: v.duracion || v.duracionVuelo || '',
          precioEconomico: Number(v.costoEconomico ?? v.precioEconomico ?? 0),
          precioPrimera: Number(v.costoPrimera ?? v.precioPrimera ?? 0),
          estado: v.estado || 'Programado',
          reservasCount: Number(v.reservasTotal ?? v.reservasCount ?? 0)
        }));

        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar vuelos:', err);
        alert('No se pudieron cargar los vuelos desde el servidor.');
      }
    });
  }

  obtenerVueloVacio(): Vuelo {
    return { 
      id: 0, 
      codigo: '', 
      origen: '', 
      destino: '', 
      fecha: new Date(), 
      horaVuelo: '', 
      duracionVuelo: '', 
      precioEconomico: 0, 
      precioPrimera: 0, 
      estado: 'Programado', 
      reservasCount: 0 
    };
  }

  get destinosDisponibles(): string[] {
    if (!this.vueloForm.origen) return this.ciudadesDestino;
    return this.ciudadesDestino.filter(c => c !== this.vueloForm.origen);
  }

  onOrigenChange(): void {
    if (this.vueloForm.destino === this.vueloForm.origen) {
      this.vueloForm.destino = '';
    }
    this.actualizarDuracionAutomatica();
  }

  onDestinoChange(): void {
    this.actualizarDuracionAutomatica();
  }

  private actualizarDuracionAutomatica(): void {
    if (!this.vueloForm.origen || !this.vueloForm.destino) {
      return;
    }

    const iataOrigen = this.extraerIata(this.vueloForm.origen);
    const iataDestino = this.extraerIata(this.vueloForm.destino);
    const claveRuta = `${iataOrigen}-${iataDestino}`;

    const minutos = this.duracionesMinutos[claveRuta] || 60;
    const horasCalculadas = Math.floor(minutos / 60);
    const minsCalculados = minutos % 60;

    const hh = String(horasCalculadas).padStart(2, '0');
    const mm = String(minsCalculados).padStart(2, '0');

    this.vueloForm.duracionVuelo = `${hh}:${mm}`;
  }

  private extraerIata(ciudadStr: string): string {
    const match = ciudadStr.match(/\(([A-Z]{3})\)/);
    return match ? match[1] : '';
  }

  get esOrigenDestinoDeshabilitado(): boolean {
    return this.editando;
  }

  get esFechaHoraDeshabilitada(): boolean {
    if (!this.editando) return false;
    return (this.vueloForm.reservasCount ?? 0) > 0;
  }

  get vuelosProgramadosCount(): number {
    return this.vuelos.filter(v => (v.estado || (v as any).estado_vuelo) === 'Programado').length;
  }

  get vuelosRealizadosCount(): number {
    return this.vuelos.filter(v => (v.estado || (v as any).estado_vuelo) === 'Realizado').length;
  }

  abrirModalNuevo(): void {
    this.editando = false;
    this.vueloForm = this.obtenerVueloVacio();
    this.mensajeErrorModal = '';
    this.mostrarModal = true;
  }

  abrirModalEditar(vuelo: Vuelo): void {
    if ((vuelo.estado || (vuelo as any).estado_vuelo) === 'Realizado') return;
    this.editando = true;
    this.vueloForm = { ...vuelo };
    this.mensajeErrorModal = '';
    this.mostrarModal = true;
  }

  cerrarModal(): void {
    this.mostrarModal = false;
    this.vueloForm = this.obtenerVueloVacio();
    this.mensajeErrorModal = '';
  }

  get minFecha(): string {
    const ahora = new Date();
    return ahora.toISOString().split('T')[0];
  }

  get maxFecha(): string {
    const unAnoDespues = new Date();
    unAnoDespues.setFullYear(unAnoDespues.getFullYear() + 1);
    return unAnoDespues.toISOString().split('T')[0];
  }

  guardarVuelo(): void {
    this.mensajeErrorModal = '';

    // 1. Campos obligatorios
    if (
      !this.vueloForm.codigo || 
      !this.vueloForm.origen || 
      !this.vueloForm.destino || 
      !this.vueloForm.fecha || 
      !this.vueloForm.horaVuelo || 
      !this.vueloForm.duracionVuelo || 
      this.vueloForm.precioEconomico <= 0 || 
      this.vueloForm.precioPrimera <= 0
    ) {
      this.mensajeErrorModal = 'Por favor completa todos los campos correctamente.';
      this.cdr.detectChanges();
      return;
    }

    const codigoLimpio = this.vueloForm.codigo.trim();

    // 2. Validación de Vuelo Duplicado (Si no estamos en modo edición)
    if (!this.editando) {
      const existeVueloProgramado = this.vuelos.some(v => 
        v.codigo.trim().toUpperCase() === codigoLimpio.toUpperCase() && v.estado === 'Programado'
      );

      if (existeVueloProgramado) {
        this.mensajeErrorModal = `El vuelo con código ${codigoLimpio} ya existe como un vuelo programado.`;
        this.cdr.detectChanges();
        return;
      }
    }

    // 3. Validación de Fechas
    const fechaVueloStr = typeof this.vueloForm.fecha === 'string' 
      ? this.vueloForm.fecha 
      : new Date(this.vueloForm.fecha).toISOString().split('T')[0];
      
    const fechaVueloTime = new Date(`${fechaVueloStr}T${this.vueloForm.horaVuelo}`).getTime();
    const ahora = new Date().getTime();
    
    const unAnoDespues = new Date();
    unAnoDespues.setFullYear(unAnoDespues.getFullYear() + 1);
    const limiteAno = unAnoDespues.getTime();

    if (fechaVueloTime < ahora) {
      this.mensajeErrorModal = 'No es posible programar vuelos con fechas o horas pasadas.';
      this.cdr.detectChanges();
      return;
    }

    if (fechaVueloTime > limiteAno) {
      this.mensajeErrorModal = 'Las aerolíneas no pueden programar vuelos con más de un año de anticipación.';
      this.cdr.detectChanges();
      return;
    }

    this.vueloForm.codigo = codigoLimpio;

    // 4. Petición al Backend
    if (this.editando) {
      this.vuelosService.editarVuelo(this.vueloForm.id, this.vueloForm).subscribe({
        next: () => {
          this.cargarVuelos();
          this.cerrarModal();
        },
        error: (err) => {
          console.error('Error al editar vuelo:', err);
          const msjBackend = err.error?.message;
          this.mensajeErrorModal = Array.isArray(msjBackend) ? msjBackend[0] : (msjBackend || 'Error al editar el vuelo en el servidor.');
          this.cdr.detectChanges();
        }
      });
    } else {
      const { id, ...payloadNuevoVuelo } = this.vueloForm;

      this.vuelosService.crearVuelo(payloadNuevoVuelo as Vuelo).subscribe({
        next: () => {
          this.cargarVuelos();
          this.cerrarModal();
        },
        error: (err) => {
          console.error('Error al crear vuelo:', err);
          const msjBackend = err.error?.message;
          
          // Muestra el mensaje directo enviado desde el DTO / Controller de NestJS
          if (Array.isArray(msjBackend)) {
            this.mensajeErrorModal = msjBackend[0];
          } else if (typeof msjBackend === 'string') {
            this.mensajeErrorModal = msjBackend;
          } else {
            this.mensajeErrorModal = 'Error al crear el vuelo en el servidor.';
          }
          this.cdr.detectChanges();
        }
      });
    }
  }

  cancelarVuelo(id: number): void {
    if (confirm('¿Estás seguro de que deseas cancelar este vuelo?')) {
      this.vuelosService.cancelarVuelo(id).subscribe({
        next: () => {
          this.cargarVuelos();
        },
        error: () => alert('Error al cancelar el vuelo en el servidor.')
      });
    }
  }

  cerrarSesion(): void {
    this.authService.cerrarSesion();
    window.location.href = '/inicio-sesion';
  }

  formatearFecha(fecha: Date | string): string {
    if (!fecha) return '-';
    const date = new Date(fecha);
    if (isNaN(date.getTime())) return '-';
    const dia = String(date.getDate()).padStart(2, '0');
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const anio = date.getFullYear();
    return `${dia}/${mes}/${anio}`;
  }

  obtenerPropiedad(obj: any, camelKey: string, snakeKey: string): any {
    if (!obj) return null;
    return obj[camelKey] !== undefined && obj[camelKey] !== null 
      ? obj[camelKey] 
      : obj[snakeKey];
  }

  obtenerPrecioNumero(obj: any, camelKey: string, snakeKey: string): number {
    const val = this.obtenerPropiedad(obj, camelKey, snakeKey);
    const num = Number(val);
    return isNaN(num) ? 0 : num;
  }
}