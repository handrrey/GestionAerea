import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { VuelosService, FiltrosBusqueda } from '../../../nucleo/servicios/vuelos';
import { Vuelo } from '../../../nucleo/modelos/vuelos.model';

@Component({
  selector: 'app-buscar-vuelos-parametrizados',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './buscar-vuelos-parametrizados.html',
  styleUrls: ['./buscar-vuelos-parametrizados.css']
})
export class BuscarVuelosParametrizadosComponent implements OnInit {

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
  rangoPrecio: string = 'Cualquiera';

  cargando: boolean = false;
  vuelosEncontrados: Vuelo[] = [];
  mensajeError: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private vuelosService: VuelosService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['origen']) this.origenSeleccionado = params['origen'];
      if (params['destino']) this.destinoSeleccionado = params['destino'];
      if (params['fecha']) this.fechaIda = params['fecha'];
      if (params['precioMaximo']) this.rangoPrecio = params['precioMaximo'];
      if (params['tipoViaje']) this.tipoViaje = params['tipoViaje'];

      if (this.origenSeleccionado && this.destinoSeleccionado) {
        this.ejecutarBusqueda();
      }
    });
  }

  get destinosDisponibles(): string[] {
    if (!this.origenSeleccionado) return this.ciudadesDestino;
    return this.ciudadesDestino.filter(c => c !== this.origenSeleccionado);
  }

  limpiarFecha(): void {
    this.fechaIda = '';
  }

  get minFecha(): string {
    return new Date().toISOString().split('T')[0];
  }

  get maxFecha(): string {
    const unAno = new Date();
    unAno.setFullYear(unAno.getFullYear() + 1);
    return unAno.toISOString().split('T')[0];
  }

  private extraerNombreCiudad(ciudadStr: string): string {
    if (!ciudadStr) return '';
    return ciudadStr.split('(')[0].trim();
  }

  ejecutarBusqueda(): void {
    this.mensajeError = '';
    this.vuelosEncontrados = [];

    if (!this.origenSeleccionado || !this.destinoSeleccionado) {
      this.mensajeError = 'Selecciona origen y destino para buscar.';
      this.cdr.detectChanges();
      return;
    }

    const origenLimpio = this.extraerNombreCiudad(this.origenSeleccionado);
    const destinoLimpio = this.extraerNombreCiudad(this.destinoSeleccionado);

    const filtros: FiltrosBusqueda = {
      origen: origenLimpio,
      destino: destinoLimpio,
      fecha: this.fechaIda || undefined,
      precioMaximo: this.rangoPrecio !== 'Cualquiera' ? Number(this.rangoPrecio) : undefined
    };

    this.cargando = true;
    this.cdr.detectChanges();

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

        this.vuelosEncontrados = resultadosMapeados.filter(v => {
          const esProgramado = (v.estado || '').toLowerCase() === 'programado';
          if (!esProgramado) return false;

          const vOrigen = (v.origen || '').toLowerCase();
          const vDestino = (v.destino || '').toLowerCase();

          const coincideOrigen = vOrigen.includes(origenLimpio.toLowerCase());
          const coincideDestino = vDestino.includes(destinoLimpio.toLowerCase()) ||
            (destinoLimpio.toLowerCase().includes('york') && vDestino.includes('york'));

          let coincideFecha = true;
          if (this.fechaIda && v.fecha) {
            const fechaVueloStr = typeof v.fecha === 'string'
              ? (v.fecha as string).split('T')[0]
              : new Date(v.fecha as any).toISOString().split('T')[0];

            coincideFecha = (fechaVueloStr === this.fechaIda);
          }

          let coincidePrecio = true;
          if (filtros.precioMaximo) {
            coincidePrecio = v.precioEconomico <= filtros.precioMaximo;
          }

          return coincideOrigen && coincideDestino && coincideFecha && coincidePrecio;
        });

        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al realizar búsqueda:', err);
        this.cargando = false;
        this.vuelosEncontrados = [];
        this.cdr.detectChanges();
      }
    });
  }

  // 🟢 Método para redireccionar a Compra/Reserva evaluando sesión
  seleccionarVuelo(vuelo: Vuelo): void {
    this.mensajeError = '';

    const sesionStr = localStorage.getItem('app_usuario_actual');
    if (!sesionStr) {
      this.mensajeError = 'Debe ser cliente registrado para hacer reservas o compras.';
      this.cdr.detectChanges();
      return;
    }

    try {
      const usuario = JSON.parse(sesionStr);
      const rol = String(usuario.rol || 'VISITANTE').toUpperCase();

      if (rol === 'VISITANTE') {
        this.mensajeError = 'Debe ser cliente registrado para hacer reservas o compras.';
        this.cdr.detectChanges();
        return;
      }

      // Redirección pasando los datos estructurados del vuelo
      this.router.navigate(['/usuario/compra-reserva'], {
        state: { vuelo }
      });

    } catch (e) {
      this.mensajeError = 'Debe ser cliente registrado para hacer reservas o compras.';
      this.cdr.detectChanges();
    }
  }
}