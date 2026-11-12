import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CompraReservaService } from '../../../nucleo/servicios/compra-reserva';
import { VuelosService } from '../../../nucleo/servicios/vuelos';

@Component({
  selector: 'app-mis-reservas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mis-reservas.html',
  styleUrls: ['./mis-reservas.css']
})
export class MisReservasComponent implements OnInit {

  private router = inject(Router);
  private reservaService = inject(CompraReservaService);
  private vuelosService = inject(VuelosService);
  private cdr = inject(ChangeDetectorRef);

  idUsuario: number = 0;
  reservas: any[] = [];
  cargando: boolean = true;
  mensajeExito: string = '';
  mensajeError: string = '';

  ngOnInit(): void {
    this.obtenerUsuarioSesion();
    this.cargarReservas();
  }

  private obtenerUsuarioSesion(): void {
    try {
      const sesionStr = localStorage.getItem('app_usuario_actual');
      if (sesionStr) {
        const usuario = JSON.parse(sesionStr);
        this.idUsuario = Number(usuario.id_usuario || usuario.idUsuario || 0);
      }
    } catch (e) {
      console.error('Error al leer sesión de usuario:', e);
    }
  }

  cargarReservas(): void {
    if (!this.idUsuario) {
      this.cargando = false;
      this.mensajeError = 'No se encontró un usuario activo en sesión.';
      this.cdr.detectChanges();
      return;
    }

    this.cargando = true;

    let mapaVuelosLocal: any = {};
    let mapaAsientosLocal: any = {};
    try {
      mapaVuelosLocal = JSON.parse(localStorage.getItem('app_mapa_vuelos_reservados') || '{}');
      mapaAsientosLocal = JSON.parse(localStorage.getItem('app_asientos_por_reserva') || '{}');
    } catch (e) {
      mapaVuelosLocal = {};
      mapaAsientosLocal = {};
    }

    forkJoin({
      reservasRes: this.reservaService.obtenerReservasPorUsuario(this.idUsuario),
      vuelosRes: this.vuelosService.obtenerVuelos().pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ reservasRes, vuelosRes }) => {
        const lista = Array.isArray(reservasRes) ? reservasRes : (reservasRes?.reservas || []);
        const listaVuelos = Array.isArray(vuelosRes) ? vuelosRes : [];

        // Mapa indexado por idVuelo con los datos reales de la tabla vuelos
        const mapaVuelosBackend: Record<number, any> = {};
        for (const vueloItem of listaVuelos as any[]) {
          const vid = Number(vueloItem.idVuelo || vueloItem.id_vuelo || vueloItem.id || 0);
          if (vid > 0) {
            mapaVuelosBackend[vid] = vueloItem;
          }
        }

        this.reservas = lista.map((r: any) => {
          const idReservaReal = Number(r.id_reserva || r.idReserva || r.id || 0);
          const idVueloReal = Number(r.id_vuelo || r.idVuelo || r.vuelo?.id_vuelo || r.vuelo?.idVuelo || 0);

          // Combinar caché local, catálogo real de vuelos y relación r.vuelo
          const v = {
            ...(mapaVuelosLocal[idVueloReal] || {}),
            ...(mapaVuelosBackend[idVueloReal] || {}),
            ...(r.vuelo || {})
          };

          const montoTotal = Number(r.monto_total || r.montoTotal || 0);
          const claseNorm = String(r.clase || 'ECONOMICA').toUpperCase();

          // 1. Calcular el número REAL de pasajeros
          const listaPasajeros = Array.isArray(r.pasajeros) ? r.pasajeros : [];
          let cantidadReal = Number(r.cantidad_pasajeros || r.cantidadPasajeros || 0);

          if (listaPasajeros.length > 0) {
            cantidadReal = listaPasajeros.length;
          } else if (cantidadReal <= 1 && montoTotal > 0) {
            const precioUnitarioBase = Number(v.precioBase || v.precioEconomico || v.costoEconomico || v.costo_economico || 0);
            if (precioUnitarioBase > 0) {
              const factorClase = claseNorm.includes('PRIMERA') ? 1.4 : 1.0;
              const estimados = Math.round(montoTotal / (precioUnitarioBase * factorClase));
              if (estimados > 1 && estimados <= 5) {
                cantidadReal = estimados;
              }
            }
          }
          if (cantidadReal < 1) cantidadReal = 1;

          // 2. Extraer o construir los asientos reservados
          const asientosGuardados = mapaAsientosLocal[idReservaReal] || mapaAsientosLocal[r.codigo_reserva || r.codigoReserva];
          const asientosLista = this.extraerAsientos(r, listaPasajeros, asientosGuardados, cantidadReal, claseNorm);

          // 3. Construir fechas ISO completas combinando fecha + hora reales del vuelo
          const fechaSalidaISO = this.combinarFechaHora(
            v.fechaVuelo || v.fecha_vuelo || v.fechaSalida || v.fecha_salida,
            v.horaVuelo || v.hora_vuelo
          );

          const fechaLlegadaISO = this.combinarFechaHora(
            v.fechaLlegada || v.fecha_llegada || v.fechaVuelo || v.fecha_vuelo,
            v.horaLlegada || v.hora_llegada
          );

          return {
            idReserva: idReservaReal,
            idVuelo: idVueloReal,
            codigo: r.codigo_reserva || r.codigoReserva || 'RSV-000',
            monto: montoTotal,
            estado: String(r.estado || 'PENDIENTE').toUpperCase(),
            fechaReserva: r.fecha_reserva || r.fechaReserva,
            fechaLimite: r.fecha_limite_pago || r.fechaLimitePago,
            cantidadPasajeros: cantidadReal,
            clase: claseNorm,
            pasajeros: listaPasajeros,
            asientos: asientosLista,
            vueloCodigo: v.codigoVuelo || v.codigo_vuelo || v.codigo || (idVueloReal ? `GA-${idVueloReal}` : 'GA-000'),
            origen: v.origen || v.ciudadOrigen || '-',
            destino: v.destino || v.ciudadDestino || '-',
            duracion: v.duracion || v.duracionVuelo || '-',
            fechaSalida: fechaSalidaISO,
            fechaLlegada: fechaLlegadaISO
          };
        });

        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Error al obtener reservas:', err);
        this.mensajeError = 'No se pudieron cargar las reservas del usuario.';
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Une fecha ("YYYY-MM-DD") y hora ("HH:mm") en un string ISO válido para el DatePipe de Angular
   */
  private combinarFechaHora(fechaRaw: any, horaRaw: any): string {
    if (!fechaRaw) return new Date().toISOString();

    // Extraer siempre solo la parte YYYY-MM-DD aunque venga con T00:00:00.000Z
    const soloFecha = String(fechaRaw).split('T')[0].trim();

    // Si hay hora explícita en el vuelo (ej. "14:30" o "14:30:00"), usarla siempre
    if (horaRaw && String(horaRaw).trim()) {
      const horaLimpia = String(horaRaw).trim().slice(0, 5);
      return `${soloFecha}T${horaLimpia}:00`;
    }

    // Si no vino hora aparte, conservar la hora que traía el string ISO si existía
    const fechaStr = String(fechaRaw);
    if (fechaStr.includes('T') && fechaStr.length > 11) {
      return fechaStr;
    }

    return `${soloFecha}T00:00:00`;
  }

  private extraerAsientos(
    reservaRaw: any,
    pasajeros: any[],
    asientosCache: string[] | undefined,
    cantidadPasajeros: number,
    clase: string
  ): string[] {
    if (Array.isArray(asientosCache) && asientosCache.length > 0) {
      return asientosCache;
    }

    if (Array.isArray(reservaRaw.sillas) && reservaRaw.sillas.length > 0) {
      return reservaRaw.sillas.map((s: any) => String(s.numero_silla || s.numeroSilla || s.codigo || s));
    }

    const sillasDesdePasajeros = pasajeros
      .map((p: any) => p.sillaActual || p.silla || p.numeroSilla || p.numero_silla)
      .filter((s: any) => Boolean(s));

    if (sillasDesdePasajeros.length > 0) {
      return sillasDesdePasajeros;
    }

    const letras = ['A', 'B', 'C', 'D', 'E', 'F'];
    const filaBase = clase.includes('PRIMERA') ? 1 : 6;
    const preliminares: string[] = [];

    for (let i = 0; i < cantidadPasajeros; i++) {
      const fila = filaBase + Math.floor(i / 6);
      const letra = letras[i % 6];
      preliminares.push(`${fila}${letra}`);
    }

    return preliminares;
  }

  irAAsignarSillas(r: any): void {
    const contextoVuelo = {
      idReserva: r.idReserva,
      codigoReserva: r.codigo,
      clase: r.clase,
      vuelo: {
        idVuelo: r.idVuelo,
        codigo: r.vueloCodigo,
        origen: r.origen,
        destino: r.destino
      },
      pasajeros: r.pasajeros.length > 0
        ? r.pasajeros
        : r.asientos.map((silla: string, idx: number) => ({
            nombreCompleto: `Pasajero ${idx + 1}`,
            clase: r.clase,
            sillaActual: silla
          }))
    };

    localStorage.setItem('app_vuelo_para_sillas', JSON.stringify(contextoVuelo));
    this.router.navigate(['/asignacion-sillas'], { state: contextoVuelo });
  }

  calcularTiempoRestante(fechaLimiteStr: string): string {
    if (!fechaLimiteStr) return '24 horas disponibles';

    const ahora = new Date().getTime();
    const limite = new Date(fechaLimiteStr).getTime();
    const diferencia = limite - ahora;

    if (diferencia <= 0) {
      return 'Reserva Expirada';
    }

    const horas = Math.floor(diferencia / (1000 * 60 * 60));
    const minutos = Math.floor((diferencia % (1000 * 60 * 60)) / (1000 * 60));

    if (horas > 0) {
      return `${horas} hora(s) y ${minutos} minuto(s)`;
    }
    return `${minutos} minuto(s)`;
  }

  pagarReserva(r: any): void {
    try {
      const itemCarrito = {
        idReserva: r.idReserva,
        codigoReserva: r.codigo,
        vuelo: {
          idVuelo: r.idVuelo,
          codigo: r.vueloCodigo,
          origen: r.origen,
          destino: r.destino,
          duracion: r.duracion,
          fechaSalida: r.fechaSalida,
          fechaLlegada: r.fechaLlegada,
          precioBase: r.monto
        },
        pasajeros: r.pasajeros,
        clase: r.clase,
        montoTotal: r.monto,
        fechaAgregado: new Date().toISOString()
      };

      const carritoActual = JSON.parse(localStorage.getItem('app_carrito_vuelos') || '[]');
      const indiceExistente = carritoActual.findIndex((item: any) => item.idReserva === r.idReserva);

      if (indiceExistente >= 0) {
        carritoActual[indiceExistente] = itemCarrito;
      } else {
        carritoActual.push(itemCarrito);
      }

      localStorage.setItem('app_carrito_vuelos', JSON.stringify(carritoActual));
      this.router.navigate(['/carrito']);
    } catch (e) {
      console.error('Error al agregar reserva al carrito:', e);
      this.mensajeError = 'No se pudo agregar la reserva al carrito.';
      this.cdr.detectChanges();
    }
  }

  cancelarReserva(idReserva: number): void {
    if (!idReserva) return;

    if (!confirm('¿Estás seguro de que deseas cancelar esta reserva? Los asientos asociados se liberarán.')) {
      return;
    }

    this.mensajeError = '';
    this.mensajeExito = '';

    this.reservaService.cancelarReserva(idReserva).subscribe({
      next: () => {
        this.mensajeExito = '¡La reserva ha sido cancelada exitosamente!';
        this.cargarReservas();
      },
      error: (err: any) => {
        console.error('Error al cancelar la reserva:', err);
        this.mensajeError = err?.error?.message || 'Error al procesar la cancelación de la reserva.';
        this.cdr.detectChanges();
      }
    });
  }

  puedeHacerCheckIn(r: any): boolean {
    if (r.estado !== 'PAGADO') return false;
    if (!r.fechaSalida) return false;

    const ahora = new Date().getTime();
    const salida = new Date(r.fechaSalida).getTime();

    if (isNaN(salida)) return false;

    const diferenciaMs = salida - ahora;
    const cuarentaYOchoHorasMs = 48 * 60 * 60 * 1000;

    // Habilitado solo si falta entre 0 y 48 horas para el vuelo
    return diferenciaMs > 0 && diferenciaMs <= cuarentaYOchoHorasMs;
  }

  irACheckIn(r: any): void {
    // Guarda el contexto de la reserva y navega a tu módulo de check-in
    localStorage.setItem('app_reserva_checkin', JSON.stringify(r));
    this.router.navigate(['/check-in'], { state: { reserva: r } });
  }
}