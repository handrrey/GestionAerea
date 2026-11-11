import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CompraReservaService } from '../../../nucleo/servicios/compra-reserva';

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

    // Obtener mapa de vuelos guardados previamente en el cliente
    let mapaVuelosLocal: any = {};
    try {
      mapaVuelosLocal = JSON.parse(localStorage.getItem('app_mapa_vuelos_reservados') || '{}');
    } catch (e) {
      mapaVuelosLocal = {};
    }

    this.reservaService.obtenerReservasPorUsuario(this.idUsuario).subscribe({
      next: (res: any) => {
        const lista = Array.isArray(res) ? res : (res?.reservas || []);

        this.reservas = lista.map((r: any) => {
          const idVueloReal = Number(r.id_vuelo || r.idVuelo || r.vuelo?.id_vuelo || r.vuelo?.idVuelo || 0);

          // Buscar el vuelo en el objeto devuelto, o en la memoria local
          const v = r.vuelo || mapaVuelosLocal[idVueloReal] || {};

          return {
            idReserva: Number(r.id_reserva || r.idReserva || r.id || 0),
            idVuelo: idVueloReal,
            codigo: r.codigo_reserva || r.codigoReserva || 'RSV-000',
            monto: Number(r.monto_total || r.montoTotal || 0),
            estado: String(r.estado || 'PENDIENTE').toUpperCase(),
            fechaReserva: r.fecha_reserva || r.fechaReserva,
            fechaLimite: r.fecha_limite_pago || r.fechaLimitePago,
            cantidadPasajeros: r.cantidad_pasajeros || r.cantidadPasajeros || (r.pasajeros?.length) || 1,
            clase: r.clase || 'ECONOMICA',
            pasajeros: r.pasajeros || [],
            vueloCodigo: v.codigo || v.codigoVuelo || (idVueloReal ? `AV-${idVueloReal}` : 'AV-800'),
            origen: v.origen || v.ciudadOrigen || 'Medellín (MDE)',
            destino: v.destino || v.ciudadDestino || 'Cali (CLO)',
            duracion: v.duracion || '02h 30m',
            fechaSalida: v.fechaSalida || v.fecha_salida || '2027-02-20T16:40:00',
            fechaLlegada: v.fechaLlegada || v.fecha_llegada || '2027-02-20T19:10:00'
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

      // Guardar en el carrito de localStorage
      const carritoActual = JSON.parse(localStorage.getItem('app_carrito_vuelos') || '[]');
      
      // Evitar duplicados del mismo idReserva en el carrito
      const indiceExistente = carritoActual.findIndex((item: any) => item.idReserva === r.idReserva);
      if (indiceExistente >= 0) {
        carritoActual[indiceExistente] = itemCarrito;
      } else {
        carritoActual.push(itemCarrito);
      }

      localStorage.setItem('app_carrito_vuelos', JSON.stringify(carritoActual));

      // Redireccionar al carrito
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
}