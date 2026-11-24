import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { VuelosService } from '../../../nucleo/servicios/vuelos';
import { Vuelo } from '../../../nucleo/modelos/vuelos.model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './home.html',
  styleUrls: ['./home.css']
})
export class HomeComponent implements OnInit {

  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private vuelosService = inject(VuelosService);

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
  rangoPrecio: string = 'Cualquiera';

  mensajeError: string = '';

  // Estado para Noticias y Promociones (últimos 6 vuelos generados vigentes)
  mostrarNoticiasYPromociones: boolean = false;
  cargandoVuelosRecientes: boolean = false;
  vuelosRecientes: Vuelo[] = [];

  ngOnInit(): void {
    this.evaluarPermisoNoticias();
    if (this.mostrarNoticiasYPromociones) {
      this.cargarUltimosVuelosGenerados();
    }
  }

  /**
   * Determina si el usuario actual puede ver "Noticias y Promociones":
   * - Visitantes (sin sesión o rol VISITANTE) -> SÍ
   * - Clientes suscritos a noticias y promociones -> SÍ
   * - Clientes no suscritos o roles administrativos -> NO
   */
  private evaluarPermisoNoticias(): void {
    try {
      const sesionStr = localStorage.getItem('app_usuario_actual');
      if (!sesionStr) {
        // Usuario visitante sin sesión iniciada
        this.mostrarNoticiasYPromociones = true;
        return;
      }

      const usuario = JSON.parse(sesionStr);
      const rol = String(usuario.rol || 'VISITANTE').toUpperCase().trim();

      if (rol === 'VISITANTE' || !usuario.id_usuario && !usuario.idUsuario) {
        this.mostrarNoticiasYPromociones = true;
        return;
      }

      if (rol === 'ADMIN' || rol === 'ROOT') {
        this.mostrarNoticiasYPromociones = false;
        return;
      }

      // Verificar si el cliente seleccionó suscribirse a promociones y noticias
      const suscritoFlag =
        usuario.suscritoNoticias ??
        usuario.suscrito_noticias ??
        usuario.recibirNoticias ??
        usuario.recibir_noticias ??
        usuario.recibirPromociones ??
        usuario.recibir_promociones ??
        usuario.promociones ??
        usuario.noticias;

      // Respaldo adicional en localStorage por ID o correo si se guardó desde el perfil/registro
      const uid = usuario.id_usuario || usuario.idUsuario;
      const respaldoSuscripcion = uid
        ? localStorage.getItem(`app_suscripcion_noticias_${uid}`)
        : null;

      this.mostrarNoticiasYPromociones =
        suscritoFlag === true ||
        suscritoFlag === 1 ||
        suscritoFlag === 'true' ||
        respaldoSuscripcion === 'true';
    } catch (e) {
      console.error('Error al evaluar suscripción a noticias:', e);
      this.mostrarNoticiasYPromociones = true;
    }
  }

  /**
   * Obtiene los vuelos reales, descarta los ya realizados/vencidos y toma los últimos 6 generados
   */
  cargarUltimosVuelosGenerados(): void {
    this.cargandoVuelosRecientes = true;
    this.cdr.detectChanges();

    this.vuelosService.obtenerVuelos().subscribe({
      next: (datosBackend: any) => {
        const listaCruda = Array.isArray(datosBackend) ? datosBackend : (datosBackend?.vuelos || []);
        const ahoraMs = Date.now();

        const vuelosVigentes = listaCruda
          .map((v: any) => {
            const rawFecha = v.fecha || v.fechaVuelo || v.fecha_vuelo || '';
            let fechaStr = '';

            if (typeof rawFecha === 'string') {
              fechaStr = rawFecha.split('T')[0];
            } else if (rawFecha instanceof Date) {
              fechaStr = this.formatearFechaIso(rawFecha);
            }

            const horaStr = String(v.horaVuelo || v.hora_vuelo || '23:59').trim().slice(0, 5);
            const idReal = Number(v.id || v.idVuelo || v.id_vuelo || 0);

            return {
              ...v,
              id: idReal,
              codigo: v.codigo || v.codigoVuelo || v.codigo_vuelo || `GA-${idReal}`,
              origen: v.origen || v.origen_vuelo || '',
              destino: v.destino || v.destino_vuelo || '',
              fecha: fechaStr,
              horaVuelo: horaStr,
              duracionVuelo: v.duracionVuelo || v.duracion || v.duracion_vuelo || 'Directo',
              precioEconomico: Number(v.precioEconomico ?? v.costoEconomico ?? v.costo_economico ?? 0),
              precioPrimera: Number(v.precioPrimera ?? v.costoPrimera ?? v.costo_primera ?? 0),
              estado: v.estado || v.estado_vuelo || 'Programado'
            };
          })
          .filter((v: any) => {
            // 1. Solo vuelos en estado Programado
            const esProgramado = String(v.estado || '').toLowerCase() === 'programado';
            if (!esProgramado) return false;

            // 2. Quitar automáticamente cuando se cumpla su tiempo de haber sido realizados
            if (!v.fecha) return false;
            const fechaHoraSalidaMs = new Date(`${v.fecha}T${v.horaVuelo || '23:59'}:00`).getTime();
            if (isNaN(fechaHoraSalidaMs)) return false;

            return fechaHoraSalidaMs > ahoraMs;
          })
          // 3. Ordenar por los últimos generados (ID más alto primero)
          .sort((a: any, b: any) => Number(b.id) - Number(a.id))
          // 4. Mostrar únicamente los últimos 6 generados
          .slice(0, 6);

        this.vuelosRecientes = vuelosVigentes;
        this.cargandoVuelosRecientes = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Error al cargar los últimos vuelos generados:', err);
        this.vuelosRecientes = [];
        this.cargandoVuelosRecientes = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Al pulsar en un vuelo de Noticias y Promociones:
   * - Si es cliente registrado, lo lleva directo a Compra/Reserva con ese vuelo.
   * - Si es visitante, lo lleva a Búsqueda Avanzada filtrado por ese origen y destino.
   */
  verDetalleOReservarVuelo(vuelo: Vuelo): void {
    try {
      const sesionStr = localStorage.getItem('app_usuario_actual');
      if (sesionStr) {
        const usuario = JSON.parse(sesionStr);
        const rol = String(usuario.rol || 'VISITANTE').toUpperCase();
        if (rol !== 'VISITANTE' && (usuario.id_usuario || usuario.idUsuario)) {
          this.router.navigate(['/compra-reserva'], {
            state: { vuelo }
          });
          return;
        }
      }
    } catch {}

    this.router.navigate(['/buscar-vuelos-parametrizados'], {
      queryParams: {
        origen: vuelo.origen || null,
        destino: vuelo.destino || null,
        fecha: vuelo.fecha || null
      }
    });
  }

  get destinosDisponibles(): string[] {
    if (!this.origenSeleccionado) {
      return this.ciudadesDestino;
    }
    return this.ciudadesDestino.filter(c => c !== this.origenSeleccionado);
  }

  onOrigenChange(): void {
    if (this.origenSeleccionado && this.destinoSeleccionado === this.origenSeleccionado) {
      this.destinoSeleccionado = '';
    }
  }

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

  buscarVuelos(): void {
    this.mensajeError = '';

    if (this.origenSeleccionado && this.destinoSeleccionado && this.origenSeleccionado === this.destinoSeleccionado) {
      this.mensajeError = 'El origen y el destino no pueden ser la misma ciudad.';
      this.cdr.detectChanges();
      return;
    }

    if (this.fechaIda) {
      const fechaSalidaMs = new Date(`${this.fechaIda}T00:00:00`).getTime();
      const hoyMs = new Date(`${this.minFecha}T00:00:00`).getTime();
      const unAnoMs = new Date(`${this.maxFecha}T00:00:00`).getTime();

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

    this.router.navigate(['/buscar-vuelos-parametrizados'], {
      queryParams: {
        origen: this.origenSeleccionado || null,
        destino: this.destinoSeleccionado || null,
        fecha: this.fechaIda || null,
        rangoPrecio: this.rangoPrecio !== 'Cualquiera' ? this.rangoPrecio : null,
        tipoViaje: this.tipoViaje
      }
    });
  }
}