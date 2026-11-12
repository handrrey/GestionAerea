import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
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
  private apiUrl = 'http://localhost:3000/appV1';
  
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

  mensajeErrorModal: string = '';

  promocionesActivasCount: number = 3;
  mensajesSinResponderCount: number = 5;

  constructor(
    private authService: AutenticacionService,
    private vuelosService: VuelosService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.usuarioActual = this.authService.obtenerUsuarioActual();
    this.cargarVuelos(); 
  }

  // 🟢 CAMBIO 1: Consultar vuelos y cruzar el conteo real de reservas existentes desde el backend
  cargarVuelos(): void {
    const reservas$ = this.http.get<any>(`${this.apiUrl}/compra-reserva`).pipe(
      catchError(() => this.http.get<any>(`${this.apiUrl}/reservas`).pipe(catchError(() => of([]))))
    );

    forkJoin({
      vuelos: this.vuelosService.obtenerVuelos(),
      reservasRes: reservas$
    }).subscribe({
      next: ({ vuelos, reservasRes }) => {
        const listaReservas = Array.isArray(reservasRes)
          ? reservasRes
          : (reservasRes?.reservas || reservasRes?.data || []);

        // Contar reservas activas (no canceladas) por id_vuelo
        const conteoPorVuelo: Record<number, number> = {};
        for (const r of listaReservas) {
          const estadoRes = String(r.estado || '').toUpperCase();
          if (estadoRes === 'CANCELADO' || estadoRes === 'EXPIRADO') continue;

          const idVueloRes = Number(r.id_vuelo || r.idVuelo || r.vuelo?.id_vuelo || r.vuelo?.idVuelo || 0);
          if (idVueloRes > 0) {
            conteoPorVuelo[idVueloRes] = (conteoPorVuelo[idVueloRes] || 0) + 1;
          }
        }

        this.vuelos = (vuelos || []).map((v: any) => {
          const idVueloReal = Number(v.idVuelo || v.id_vuelo || v.id || 0);
          const reservasDesdeArray = Array.isArray(v.reservas)
            ? v.reservas.filter((r: any) => String(r.estado || '').toUpperCase() !== 'CANCELADO').length
            : 0;

          const reservasReales = Math.max(
            conteoPorVuelo[idVueloReal] || 0,
            reservasDesdeArray,
            Number(v.reservasTotal ?? v.reservasCount ?? v.reservas_count ?? 0)
          );

          return {
            ...v,
            id: idVueloReal,
            codigo: v.codigoVuelo || v.codigo || '',
            origen: v.origen || '',
            destino: v.destino || '',
            fecha: v.fechaVuelo || v.fecha || '',
            horaVuelo: v.horaVuelo || '',
            duracionVuelo: v.duracion || v.duracionVuelo || '',
            precioEconomico: Number(v.costoEconomico ?? v.precioEconomico ?? 0),
            precioPrimera: Number(v.costoPrimera ?? v.precioPrimera ?? 0),
            estado: v.estado || 'Programado',
            reservasCount: reservasReales
          };
        });

        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar vuelos:', err);
        alert('No se pudieron cargar los vuelos desde el servidor.');
      }
    });
  }

  generarCodigoAleatorio(): string {
    const numeroAleatorio = Math.floor(1000 + Math.random() * 9000);
    return `GA-${numeroAleatorio}`;
  }

  obtenerVueloVacio(): Vuelo {
    return { 
      id: 0, 
      codigo: this.generarCodigoAleatorio(), 
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

  // 🟢 CAMBIO 2: Calcular automáticamente el precio de Primera Clase (+40% sobre Económico)
  onPrecioEconomicoChange(): void {
    const economico = Number(this.vueloForm.precioEconomico || 0);
    this.vueloForm.precioPrimera = economico > 0 ? Math.round(economico * 1.4) : 0;
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
    this.mensajeErrorModal = '';

    let fechaFormateada = '';
    const rawFecha: any = vuelo.fecha || (vuelo as any).fechaVuelo;

    if (rawFecha) {
      if (typeof rawFecha === 'string') {
        fechaFormateada = rawFecha.split('T')[0];
      } else if (rawFecha instanceof Date) {
        fechaFormateada = rawFecha.toISOString().split('T')[0];
      } else {
        const d = new Date(rawFecha);
        if (!isNaN(d.getTime())) {
          fechaFormateada = d.toISOString().split('T')[0];
        }
      }
    }

    const vAny = vuelo as any;
    const origenRaw = vuelo.origen || vAny.origen || vAny.origen_vuelo || '';
    const destinoRaw = vuelo.destino || vAny.destino || vAny.destino_vuelo || '';

    const origenCoincidencia = this.ciudadesOrigen.find(c => 
      c.toLowerCase().includes(origenRaw.toLowerCase())
    ) || origenRaw;

    const destinoCoincidencia = this.ciudadesDestino.find(c => 
      c.toLowerCase().includes(destinoRaw.toLowerCase())
    ) || destinoRaw;

    const econ = Number(vuelo.precioEconomico ?? vAny.costoEconomico ?? 0);

    this.vueloForm = {
      id: vuelo.id || vAny.idVuelo || 0,
      codigo: vuelo.codigo || vAny.codigoVuelo || '',
      origen: origenCoincidencia,
      destino: destinoCoincidencia,
      fecha: fechaFormateada as any,
      horaVuelo: vuelo.horaVuelo || vAny.hora_vuelo || '',
      duracionVuelo: vuelo.duracionVuelo || vAny.duracion || '',
      precioEconomico: econ,
      precioPrimera: econ > 0 ? Math.round(econ * 1.4) : Number(vuelo.precioPrimera ?? vAny.costoPrimera ?? 0),
      estado: vuelo.estado || vAny.estado_vuelo || 'Programado',
      reservasCount: Number(vuelo.reservasCount ?? vAny.reservasTotal ?? 0)
    };

    if (!this.vueloForm.duracionVuelo) {
      this.actualizarDuracionAutomatica();
    }

    this.mostrarModal = true;
    this.cdr.detectChanges();
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

  private convertirHoraA24h(horaStr: string): string {
    if (!horaStr) return '00:00';

    let h = 0;
    let m = 0;

    const strLower = horaStr.toLowerCase();
    const esPM = strLower.includes('p');
    const esAM = strLower.includes('a');

    const numeros = horaStr.match(/\d+/g);
    if (!numeros || numeros.length < 2) {
      return '00:00';
    }

    h = parseInt(numeros[0], 10);
    m = parseInt(numeros[1], 10);

    if (esPM && h < 12) h += 12;
    if (esAM && h === 12) h = 0;

    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');

    return `${hh}:${mm}`;
  }

  guardarVuelo(): void {
    this.mensajeErrorModal = '';

    // Asegurar que precioPrimera siempre sea 40% más que precioEconomico antes de validar y guardar
    this.onPrecioEconomicoChange();

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

    let fechaVueloStr = '';
    const rawFecha: any = this.vueloForm.fecha;

    if (typeof rawFecha === 'string') {
      fechaVueloStr = rawFecha.split('T')[0];
    } else if (rawFecha instanceof Date) {
      fechaVueloStr = rawFecha.toISOString().split('T')[0];
    } else {
      const d = new Date(rawFecha);
      fechaVueloStr = !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : '';
    }

    const hora24h = this.convertirHoraA24h(this.vueloForm.horaVuelo);

    const fechaVueloTime = new Date(`${fechaVueloStr}T${hora24h}:00`).getTime();
    const ahora = new Date().getTime();
    
    const unAnoDespues = new Date();
    unAnoDespues.setFullYear(unAnoDespues.getFullYear() + 1);
    const limiteAno = unAnoDespues.getTime();

    if (isNaN(fechaVueloTime) || fechaVueloTime < ahora) {
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

    if (this.editando) {
      const payloadEditar = {
        codigo: this.vueloForm.codigo,
        origen: this.vueloForm.origen,
        destino: this.vueloForm.destino,
        fecha: fechaVueloStr,
        horaVuelo: hora24h,
        duracionVuelo: this.vueloForm.duracionVuelo,
        precioEconomico: Number(this.vueloForm.precioEconomico),
        precioPrimera: Number(this.vueloForm.precioPrimera),
        estado: this.vueloForm.estado
      };

      this.vuelosService.editarVuelo(this.vueloForm.id, payloadEditar as any).subscribe({
        next: () => {
          this.cargarVuelos();
          this.cerrarModal();
        },
        error: (err) => {
          console.error('Error al editar vuelo:', err);
          const msjBackend = err.error?.message;
          if (Array.isArray(msjBackend)) {
            this.mensajeErrorModal = msjBackend[0];
          } else if (typeof msjBackend === 'string') {
            this.mensajeErrorModal = msjBackend;
          } else {
            this.mensajeErrorModal = 'Error al editar el vuelo en el servidor.';
          }
          this.cdr.detectChanges();
        }
      });
    } else {
      const { id, ...payloadNuevoVuelo } = this.vueloForm;
      payloadNuevoVuelo.fecha = fechaVueloStr as any;
      payloadNuevoVuelo.horaVuelo = hora24h;
      payloadNuevoVuelo.precioPrimera = Math.round(Number(payloadNuevoVuelo.precioEconomico) * 1.4);

      this.vuelosService.crearVuelo(payloadNuevoVuelo as Vuelo).subscribe({
        next: () => {
          this.cargarVuelos();
          this.cerrarModal();
        },
        error: (err) => {
          console.error('Error al guardar vuelo:', err);

          if (err.status === 401) {
            this.mensajeErrorModal = 'Tu sesión ha expirado o no tienes permisos. Inicia sesión nuevamente.';
          } else {
            const msjBackend = err.error?.message;
            if (Array.isArray(msjBackend)) {
              this.mensajeErrorModal = msjBackend[0];
            } else if (typeof msjBackend === 'string') {
              this.mensajeErrorModal = msjBackend;
            } else {
              this.mensajeErrorModal = 'Error al procesar el vuelo en el servidor.';
            }
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