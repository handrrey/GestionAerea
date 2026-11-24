import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CompraReservaService } from '../../../nucleo/servicios/compra-reserva';
import { VuelosService } from '../../../nucleo/servicios/vuelos';
import { BilleteraService } from '../../../nucleo/servicios/billetera-virtual';

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
  private billeteraService = inject(BilleteraService);
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
    let mapaClasesLocal: any = {};
    try {
      mapaVuelosLocal = JSON.parse(localStorage.getItem('app_mapa_vuelos_reservados') || '{}');
      mapaAsientosLocal = JSON.parse(localStorage.getItem('app_asientos_por_reserva') || '{}');
      mapaClasesLocal = JSON.parse(localStorage.getItem('app_clases_por_reserva') || '{}');
    } catch (e) {
      mapaVuelosLocal = {};
      mapaAsientosLocal = {};
      mapaClasesLocal = {};
    }

    forkJoin({
      reservasRes: this.reservaService.obtenerReservasPorUsuario(this.idUsuario),
      vuelosRes: this.vuelosService.obtenerVuelos().pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ reservasRes, vuelosRes }) => {
        const lista = Array.isArray(reservasRes) ? reservasRes : (reservasRes?.reservas || []);
        const listaVuelos = Array.isArray(vuelosRes) ? vuelosRes : [];

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
          const codigoReservaReal = r.codigo_reserva || r.codigoReserva || 'RSV-000';

          const v = {
            ...(mapaVuelosLocal[idVueloReal] || {}),
            ...(mapaVuelosBackend[idVueloReal] || {}),
            ...(r.vuelo || {})
          };

          const montoTotal = Number(r.monto_total || r.montoTotal || 0);
          const listaPasajeros = Array.isArray(r.pasajeros) ? r.pasajeros : [];

          // 1. Obtener la clase desde localStorage (si se guardó al comprar/reservar) o desde el backend
          const claseGuardadaLocal = mapaClasesLocal[idReservaReal] || mapaClasesLocal[codigoReservaReal];
          const claseBackend =
            r.clase ||
            r.clase_boleto ||
            r.claseBoleto ||
            r.tipo_clase ||
            r.tipoClase ||
            listaPasajeros[0]?.clase ||
            '';

          let claseNorm = String(claseGuardadaLocal || claseBackend || '').toUpperCase();

          // 2. Calcular la cantidad real de pasajeros
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

          // 3. Verificar contra el precio de Primera Clase del vuelo por si el backend omitió el campo clase
          const precioPrimera = Number(v.costoPrimera || v.costo_primera || v.precioPrimera || 0);
          const precioEconomico = Number(v.costoEconomico || v.costo_economico || v.precioEconomico || v.precioBase || 0);

          if ((!claseNorm || claseNorm === 'ECONOMICA') && precioPrimera > 0 && montoTotal > 0) {
            const unitarioPagado = montoTotal / cantidadReal;
            if (
              Math.abs(unitarioPagado - precioPrimera) <= 100 ||
              (precioEconomico > 0 && unitarioPagado > precioEconomico * 1.2)
            ) {
              claseNorm = 'PRIMERA_CLASE';
            }
          }

          if (!claseNorm) {
            claseNorm = 'ECONOMICA';
          }

          const asientosGuardados = mapaAsientosLocal[idReservaReal] || mapaAsientosLocal[codigoReservaReal];
          const asientosLista = this.extraerAsientos(r, listaPasajeros, asientosGuardados, cantidadReal, claseNorm);

          const fechaSalidaISO = this.combinarFechaHora(
            v.fechaVuelo || v.fecha_vuelo || v.fechaSalida || v.fecha_salida,
            v.horaVuelo || v.hora_vuelo
          );

          const fechaLlegadaISO = this.combinarFechaHora(
            v.fechaLlegada || v.fecha_llegada || v.fechaVuelo || v.fecha_vuelo,
            v.horaLlegada || v.hora_llegada
          );

          const origenStr = v.origen || v.ciudadOrigen || '-';
          const destinoStr = v.destino || v.ciudadDestino || '-';
          const tipoVueloStr = v.tipoVuelo || v.tipo_vuelo || v.tipo || this.inferirTipoVuelo(origenStr, destinoStr);

          return {
            idReserva: idReservaReal,
            idVuelo: idVueloReal,
            codigo: codigoReservaReal,
            monto: montoTotal,
            estado: String(r.estado || 'PENDIENTE').toUpperCase(),
            fechaReserva: r.fecha_reserva || r.fechaReserva,
            fechaLimite: r.fecha_limite_pago || r.fechaLimitePago,
            cantidadPasajeros: cantidadReal,
            clase: claseNorm,
            tipoVuelo: tipoVueloStr,
            pasajeros: listaPasajeros,
            asientos: asientosLista,
            vueloCodigo: v.codigoVuelo || v.codigo_vuelo || v.codigo || (idVueloReal ? `GA-${idVueloReal}` : 'GA-000'),
            origen: origenStr,
            destino: destinoStr,
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

  private inferirTipoVuelo(origen: string, destino: string): string {
    const ruta = `${origen} ${destino}`.toLowerCase();
    const internacionales = [
      'madrid', '(mad)', 'miami', '(mia)', 'nueva york', 'new york', '(nyc)',
      'londres', 'london', '(lon)', 'buenos aires', '(bue)', 'panama', 'lima', 'quito'
    ];
    return internacionales.some(c => ruta.includes(c)) ? 'Internacional' : 'Nacional';
  }

  private combinarFechaHora(fechaRaw: any, horaRaw: any): string {
    if (!fechaRaw) return new Date().toISOString();

    const soloFecha = String(fechaRaw).split('T')[0].trim();

    if (horaRaw && String(horaRaw).trim()) {
      const horaLimpia = String(horaRaw).trim().slice(0, 5);
      return `${soloFecha}T${horaLimpia}:00`;
    }

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
    const pasajerosNormalizados = (r.pasajeros.length > 0
      ? r.pasajeros
      : r.asientos.map((silla: string, idx: number) => ({
          nombreCompleto: `Pasajero ${idx + 1}`,
          sillaActual: silla
        }))
    ).map((p: any, idx: number) => ({
      ...p,
      clase: r.clase,
      sillaActual: p.sillaActual || p.silla || p.numeroSilla || p.numero_silla || r.asientos[idx] || ''
    }));

    const contextoVuelo = {
      idReserva: r.idReserva,
      codigoReserva: r.codigo,
      clase: r.clase,
      vuelo: {
        idVuelo: r.idVuelo,
        codigo: r.vueloCodigo,
        tipo: r.tipoVuelo,
        tipoVuelo: r.tipoVuelo,
        origen: r.origen,
        destino: r.destino
      },
      pasajeros: pasajerosNormalizados
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

  /**
   * Un vuelo PAGADO solo es cancelable si falta más de 1 hora para su salida
   */
  puedeCancelarVueloPagado(r: any): boolean {
    if (r.estado !== 'PAGADO') return false;
    if (!r.fechaSalida) return false;

    const ahora = new Date().getTime();
    const salida = new Date(r.fechaSalida).getTime();
    if (isNaN(salida)) return false;

    const unaHoraMs = 60 * 60 * 1000;
    return (salida - ahora) > unaHoraMs;
  }

  /**
   * Cancela un vuelo ya PAGADO (> 1h antes de salir) y devuelve el valor a la billetera virtual
   */
  cancelarVueloPagado(r: any): void {
    if (!r || !r.idReserva) return;

    if (!this.puedeCancelarVueloPagado(r)) {
      this.mensajeError = 'Este vuelo ya no puede cancelarse porque falta menos de 1 hora para su salida.';
      this.cdr.detectChanges();
      return;
    }

    const montoReembolso = Number(r.monto || 0);
    const confirmado = confirm(
      `¿Estás seguro de cancelar el vuelo ${r.vueloCodigo} (${r.origen} → ${r.destino})?\n\n` +
      `Se devolverán $${montoReembolso.toLocaleString('es-CO')} COP al saldo de tu billetera virtual y se liberarán tus asientos.`
    );

    if (!confirmado) return;

    this.mensajeError = '';
    this.mensajeExito = '';

    this.billeteraService.obtenerEstadoBilletera(this.idUsuario).pipe(catchError(() => of(null))).subscribe((estadoPrevio: any) => {
      const billeteraPrevia = estadoPrevio?.billetera || estadoPrevio;
      const saldoAntes = Number(billeteraPrevia?.saldo ?? 0);
      const idTarjetaRespaldo = Number(estadoPrevio?.tarjetas?.[0]?.id_tarjeta || estadoPrevio?.tarjetas?.[0]?.idTarjeta || 0);

      this.reservaService.cancelarReserva(r.idReserva).subscribe({
        next: () => {
          this.billeteraService.obtenerEstadoBilletera(this.idUsuario).pipe(catchError(() => of(null))).subscribe((estadoDespues: any) => {
            const billeteraDespues = estadoDespues?.billetera || estadoDespues;
            const saldoDespues = Number(billeteraDespues?.saldo ?? saldoAntes);

            const yaReembolsadoEnBackend = saldoDespues >= (saldoAntes + montoReembolso) && montoReembolso > 0;

            if (!yaReembolsadoEnBackend && montoReembolso > 0) {
              this.billeteraService.recargarSaldo(this.idUsuario, montoReembolso, idTarjetaRespaldo)
                .pipe(catchError(() => of(null)))
                .subscribe(() => {
                  this.finalizarReembolsoUI(saldoAntes + montoReembolso, montoReembolso);
                });
            } else {
              this.finalizarReembolsoUI(saldoDespues, montoReembolso);
            }
          });
        },
        error: (err: any) => {
          console.error('Error al cancelar vuelo pagado:', err);
          this.mensajeError = err?.error?.message || 'Error al procesar la cancelación del vuelo.';
          this.cdr.detectChanges();
        }
      });
    });
  }

  private finalizarReembolsoUI(nuevoSaldo: number, montoReembolsado: number): void {
    try {
      const sesionStr = localStorage.getItem('app_usuario_actual');
      if (sesionStr) {
        const usuario = JSON.parse(sesionStr);
        usuario.saldo = nuevoSaldo;
        if (usuario.saldo_actual !== undefined) usuario.saldo_actual = nuevoSaldo;
        localStorage.setItem('app_usuario_actual', JSON.stringify(usuario));
      }
    } catch {}

    this.mensajeExito = `¡Vuelo cancelado! Se reembolsaron $${montoReembolsado.toLocaleString('es-CO')} COP al saldo de tu billetera virtual.`;
    this.cargarReservas();
  }

  puedeHacerCheckIn(r: any): boolean {
    if (r.estado !== 'PAGADO') return false;
    if (!r.fechaSalida) return false;

    const ahora = new Date().getTime();
    const salida = new Date(r.fechaSalida).getTime();

    if (isNaN(salida)) return false;

    const diferenciaMs = salida - ahora;
    const cuarentaYOchoHorasMs = 48 * 60 * 60 * 1000;

    return diferenciaMs > 0 && diferenciaMs <= cuarentaYOchoHorasMs;
  }

  irACheckIn(r: any): void {
    localStorage.setItem('app_reserva_checkin', JSON.stringify(r));
    this.router.navigate(['/check-in'], { state: { reserva: r } });
  }
}