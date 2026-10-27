import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { VuelosService, FiltrosBusqueda } from '../../../nucleo/servicios/vuelos';
import { Vuelo } from '../../../nucleo/modelos/vuelos.model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './home.html',
  styleUrls: ['./home.css']
})
export class HomeComponent implements OnInit {

  ciudadesOrigen: string[] = [
    'Pereira (PEI)', 'Bogotá (BOG)', 'Medellín (MDE)', 'Cali (CLO)', 'Cartagena (CTG)'
  ];

  ciudadesDestino: string[] = [
    'Pereira (PEI)', 'Bogotá (BOG)', 'Medellín (MDE)', 'Cartagena (CTG)',
    'Cali (CLO)', 'Miami (MIA)', 'Madrid (MAD)', 'Buenos Aires (BUE)',
    'Londres (LON)', 'Nueva York (NYC)'
  ];

  tipoViaje: 'SOLO_IDA' | 'IDA_Y_VUELTA' = 'SOLO_IDA';
  origenSeleccionado: string = '';
  destinoSeleccionado: string = '';
  fechaIda: string = '';
  fechaVuelta: string = '';
  pasajeros: number = 1;
  rangoPrecio: string = 'Cualquiera';

  mensajeError: string = '';
  cargando: boolean = false;
  busquedaRealizada: boolean = false;
  vuelosEncontrados: Vuelo[] = [];

  constructor(
    private vuelosService: VuelosService,
    private router: Router,
    private cdr: ChangeDetectorRef // Inyectamos ChangeDetectorRef para forzar renderizado inmediato
  ) {}

  ngOnInit(): void {}

  get destinosDisponibles(): string[] {
    if (!this.origenSeleccionado) {
      return this.ciudadesDestino;
    }
    return this.ciudadesDestino.filter(c => c !== this.origenSeleccionado);
  }

  onOrigenChange(): void {
    if (this.destinoSeleccionado === this.origenSeleccionado) {
      this.destinoSeleccionado = '';
    }
  }

  // 🟢 Botón/Acción para omitir la fecha y buscar solo por Origen y Destino
  limpiarFecha(): void {
    this.fechaIda = '';
    this.fechaVuelta = '';
  }

  get minFecha(): string {
    const hoy = new Date();
    return this.formatearFechaIso(hoy);
  }

  get maxFecha(): string {
    const unAnoDespues = new Date();
    unAnoDespues.setFullYear(unAnoDespues.getFullYear() + 1);
    return this.formatearFechaIso(unAnoDespues);
  }

  private formatearFechaIso(date: Date): string {
    const anio = date.getFullYear();
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const dia = String(date.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }

  seleccionarTipoViaje(tipo: 'SOLO_IDA' | 'IDA_Y_VUELTA'): void {
    this.tipoViaje = tipo;
    if (this.tipoViaje === 'SOLO_IDA') {
      this.fechaVuelta = '';
    }
  }

  private extraerNombreCiudad(ciudadStr: string): string {
    if (!ciudadStr) return '';
    return ciudadStr.split('(')[0].trim();
  }

  buscarVuelos(): void {
    this.mensajeError = '';
    this.vuelosEncontrados = [];

    // 1. Validaciones de formulario
    if (!this.origenSeleccionado || !this.destinoSeleccionado) {
      this.mensajeError = 'Selecciona la ciudad de origen y destino.';
      this.cdr.detectChanges();
      return;
    }

    if (this.fechaIda) {
      const fechaSalidaMs = new Date(this.fechaIda).getTime();
      const hoyMs = new Date(this.minFecha).getTime();
      const unAnoMs = new Date(this.maxFecha).getTime();

      if (fechaSalidaMs < hoyMs) {
        this.mensajeError = 'No puedes seleccionar una fecha de ida anterior a hoy.';
        this.cdr.detectChanges();
        return;
      }
      if (fechaSalidaMs > unAnoMs) {
        this.mensajeError = 'No se pueden buscar vuelos con más de un año de anticipación.';
        this.cdr.detectChanges();
        return;
      }
    }

    // 2. Extracción de filtros
    const origenLimpio = this.extraerNombreCiudad(this.origenSeleccionado);
    const destinoLimpio = this.extraerNombreCiudad(this.destinoSeleccionado);

    const filtros: FiltrosBusqueda = {
      origen: origenLimpio,
      destino: destinoLimpio,
      fecha: this.fechaIda || undefined,
      precioMaximo: this.rangoPrecio !== 'Cualquiera' ? Number(this.rangoPrecio) : undefined
    };

    this.cargando = true;
    this.busquedaRealizada = true;
    this.cdr.detectChanges(); // Renderiza de inmediato el indicador de carga

    // 3. Petición al Backend y Filtrado Estricto
    this.vuelosService.buscarVuelosParametrizados(filtros).subscribe({
      next: (datosBackend: any[]) => {
        const resultadosMapeados: Vuelo[] = (datosBackend || []).map(v => {
          let rawFecha = v.fecha || v.fechaVuelo || v.fecha_vuelo || '';
          let fechaStr = '';

          if (typeof rawFecha === 'string') {
            fechaStr = rawFecha.split('T')[0];
          } else if (rawFecha instanceof Date) {
            const d = new Date(rawFecha);
            const a = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dia = String(d.getDate()).padStart(2, '0');
            fechaStr = `${a}-${m}-${dia}`;
          }

          return {
            ...v,
            id: v.id || v.idVuelo || v.id_vuelo || 0,
            codigo: v.codigo || v.codigoVuelo || v.codigo_vuelo || 'GA-000',
            origen: v.origen || v.origen_vuelo || '',
            destino: v.destino || v.destino_vuelo || '',
            fecha: fechaStr,
            horaVuelo: v.horaVuelo || v.hora_vuelo || '',
            duracionVuelo: v.duracionVuelo || v.duracion || v.duracion_vuelo || '',
            precioEconomico: Number(v.precioEconomico ?? v.costoEconomico ?? v.costo_economico ?? 0),
            precioPrimera: Number(v.precioPrimera ?? v.costoPrimera ?? v.costo_primera ?? 0),
            estado: v.estado || v.estado_vuelo || 'Programado'
          };
        });

        // 🟢 FILTRO ESTRICTO: Coincidencia de Origen, Destino, Fecha, Precio Y Estado "Programado"
        this.vuelosEncontrados = resultadosMapeados.filter(v => {
          // A. Condición obligatoria: SOLO VUELOS PROGRAMADOS
          const esProgramado = (v.estado || '').toLowerCase() === 'programado';
          if (!esProgramado) return false;

          // B. Coincidencia de Origen y Destino
          const vOrigen = (v.origen || '').toLowerCase();
          const vDestino = (v.destino || '').toLowerCase();

          const coincideOrigen = vOrigen.includes(origenLimpio.toLowerCase());
          const coincideDestino = vDestino.includes(destinoLimpio.toLowerCase()) ||
            (destinoLimpio.toLowerCase().includes('york') && vDestino.includes('york'));

          // C. Coincidencia de Fecha (si el usuario la especificó)
          let coincideFecha = true;
          if (this.fechaIda && v.fecha) {
            const fechaVueloStr = typeof v.fecha === 'string'
              ? (v.fecha as string).split('T')[0]
              : new Date(v.fecha as any).toISOString().split('T')[0];

            coincideFecha = (fechaVueloStr === this.fechaIda);
          }

          // D. Coincidencia de Precio Máximo
          let coincidePrecio = true;
          if (filtros.precioMaximo) {
            coincidePrecio = v.precioEconomico <= filtros.precioMaximo;
          }

          return coincideOrigen && coincideDestino && coincideFecha && coincidePrecio;
        });

        this.cargando = false;
        this.cdr.detectChanges(); // Actualiza la UI al instante
      },
      error: (err) => {
        console.error('Error al realizar la búsqueda parametrizada:', err);
        this.cargando = false;
        this.vuelosEncontrados = [];
        this.cdr.detectChanges();
      }
    });
  }
}