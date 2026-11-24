import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
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
      this.origenSeleccionado = params['origen'] || '';
      this.destinoSeleccionado = params['destino'] || '';
      this.fechaIda = params['fecha'] || '';
      this.rangoPrecio = params['rangoPrecio'] || params['precioMaximo'] || 'Cualquiera';
      if (params['tipoViaje']) this.tipoViaje = params['tipoViaje'];

      // Ejecutar búsqueda automáticamente sin importar si viene 1 filtro, varios o ninguno
      this.ejecutarBusqueda();
    });
  }

  get destinosDisponibles(): string[] {
    if (!this.origenSeleccionado) return this.ciudadesDestino;
    return this.ciudadesDestino.filter(c => c !== this.origenSeleccionado);
  }

  onOrigenChange(): void {
    if (this.origenSeleccionado && this.destinoSeleccionado === this.origenSeleccionado) {
      this.destinoSeleccionado = '';
    }
  }

  limpiarFecha(): void {
    this.fechaIda = '';
  }

  limpiarFiltros(): void {
    this.origenSeleccionado = '';
    this.destinoSeleccionado = '';
    this.fechaIda = '';
    this.rangoPrecio = 'Cualquiera';
    this.ejecutarBusqueda();
  }

  get minFecha(): string {
    return new Date().toISOString().split('T')[0];
  }

  get maxFecha(): string {
    const unAno = new Date();
    unAno.setFullYear(unAno.getFullYear() + 1);
    return unAno.toISOString().split('T')[0];
  }

  get descripcionFiltrosActivos(): string {
    const activos: string[] = [];
    if (this.origenSeleccionado) activos.push(`Origen: ${this.origenSeleccionado}`);
    if (this.destinoSeleccionado) activos.push(`Destino: ${this.destinoSeleccionado}`);
    if (this.fechaIda) activos.push(`Fecha: ${this.fechaIda}`);
    if (this.rangoPrecio !== 'Cualquiera') activos.push(`Rango: ${this.formatearEtiquetaRango(this.rangoPrecio)}`);

    return activos.length > 0 ? activos.join(' | ') : 'Todos los vuelos programados';
  }

  private formatearEtiquetaRango(rango: string): string {
    const mapa: Record<string, string> = {
      '0-500000': '$0 - $500.000 COP',
      '500000-1500000': "$500.000 - $1'500.000 COP",
      '1500000-3000000': "$1'500.000 - $3'000.000 COP",
      '3000000-5000000': "$3'000.000 - $5'000.000 COP",
      '5000000-999999999': "Más de $5'000.000 COP"
    };
    return mapa[rango] || rango;
  }

  private extraerNombreCiudad(ciudadStr: string): string {
    if (!ciudadStr) return '';
    return ciudadStr.split('(')[0].trim();
  }

  private normalizarTexto(texto: string): string {
    return String(texto || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private parsearRangoPrecio(): { min: number; max: number } | null {
    if (!this.rangoPrecio || this.rangoPrecio === 'Cualquiera') return null;

    if (this.rangoPrecio.includes('-')) {
      const [minStr, maxStr] = this.rangoPrecio.split('-');
      return {
        min: Number(minStr) || 0,
        max: Number(maxStr) || Number.MAX_SAFE_INTEGER
      };
    }

    // Compatibilidad si viene un número único
    const maxUnico = Number(this.rangoPrecio);
    return isNaN(maxUnico) ? null : { min: 0, max: maxUnico };
  }

  ejecutarBusqueda(): void {
    this.mensajeError = '';
    this.vuelosEncontrados = [];

    if (this.origenSeleccionado && this.destinoSeleccionado && this.origenSeleccionado === this.destinoSeleccionado) {
      this.mensajeError = 'El origen y el destino no pueden ser la misma ciudad.';
      this.cdr.detectChanges();
      return;
    }

    const origenLimpio = this.extraerNombreCiudad(this.origenSeleccionado);
    const destinoLimpio = this.extraerNombreCiudad(this.destinoSeleccionado);
    const rangoParsed = this.parsearRangoPrecio();

    const filtros: FiltrosBusqueda = {
      origen: origenLimpio || undefined,
      destino: destinoLimpio || undefined,
      fecha: this.fechaIda || undefined,
      precioMaximo: rangoParsed ? rangoParsed.max : undefined
    };

    this.cargando = true;
    this.cdr.detectChanges();

    // Si ambos (origen y destino) están presentes, usa búsqueda parametrizada con fallback a obtenerVuelos();
    // si falta alguno, consulta el catálogo completo para filtrar por cualquier combinación parcial.
    const consulta$ = (origenLimpio && destinoLimpio)
      ? this.vuelosService.buscarVuelosParametrizados(filtros).pipe(
          catchError(() => this.vuelosService.obtenerVuelos())
        )
      : this.vuelosService.obtenerVuelos();

    consulta$.subscribe({
      next: (datosBackend: any) => {
        const listaCruda = Array.isArray(datosBackend) ? datosBackend : (datosBackend?.vuelos || []);

        const resultadosMapeados: Vuelo[] = listaCruda.map((v: any) => {
          const rawFecha = v.fecha || v.fechaVuelo || v.fecha_vuelo || '';
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

        const origenNorm = this.normalizarTexto(origenLimpio);
        const destinoNorm = this.normalizarTexto(destinoLimpio);

        this.vuelosEncontrados = resultadosMapeados.filter(v => {
          const esProgramado = (v.estado || '').toLowerCase() === 'programado';
          if (!esProgramado) return false;

          // 1. Filtro de Origen (solo aplica si el usuario eligió origen)
          if (origenNorm) {
            const vOrigenNorm = this.normalizarTexto(v.origen);
            if (!vOrigenNorm.includes(origenNorm)) return false;
          }

          // 2. Filtro de Destino (solo aplica si el usuario eligió destino)
          if (destinoNorm) {
            const vDestinoNorm = this.normalizarTexto(v.destino);
            const coincideDestino = vDestinoNorm.includes(destinoNorm) ||
              (destinoNorm.includes('york') && vDestinoNorm.includes('york'));
            if (!coincideDestino) return false;
          }

          // 3. Filtro de Fecha (solo aplica si el usuario eligió fecha)
          if (this.fechaIda) {
            const fechaVueloStr = typeof v.fecha === 'string'
              ? (v.fecha as string).split('T')[0]
              : (v.fecha ? new Date(v.fecha as any).toISOString().split('T')[0] : '');

            if (fechaVueloStr !== this.fechaIda) return false;
          }

          // 4. Filtro de Rango de Precio (min <= precio <= max)
          if (rangoParsed) {
            const precio = Number(v.precioEconomico || 0);
            if (precio < rangoParsed.min || precio > rangoParsed.max) {
              return false;
            }
          }

          return true;
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

      this.router.navigate(['/compra-reserva'], {
        state: { vuelo }
      });

    } catch (e) {
      this.mensajeError = 'Debe ser cliente registrado para hacer reservas o compras.';
      this.cdr.detectChanges();
    }
  }
}