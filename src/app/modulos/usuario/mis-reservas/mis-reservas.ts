import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CompraReservaService } from '../../../nucleo/servicios/compra-reserva';

@Component({
  selector: 'app-mis-reservas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mis-reservas.html',
  styleUrls: ['./mis-reservas.css']
})
export class MisReservasComponent implements OnInit {

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
    this.reservaService.obtenerReservasPorUsuario(this.idUsuario).subscribe({
      next: (res: any) => {
        const lista = Array.isArray(res) ? res : (res?.reservas || []);

        this.reservas = lista.map((r: any) => {
          const vueloObj = r.vuelo || {};
          
          return {
            idReserva: Number(r.id_reserva || r.idReserva || r.id || 0),
            codigo: r.codigo_reserva || r.codigoReserva || 'RSV-000',
            monto: Number(r.monto_total || r.montoTotal || 0),
            estado: String(r.estado || 'PENDIENTE').toUpperCase(),
            fechaReserva: r.fecha_reserva || r.fechaReserva,
            fechaLimite: r.fecha_limite_pago || r.fechaLimitePago,
            cantidadPasajeros: r.cantidad_pasajeros || r.cantidadPasajeros || 1,
            vueloCodigo: vueloObj.codigo || r.codigo_vuelo || r.codigoVuelo || 'GA-000',
            origen: vueloObj.origen || r.origen || 'Origen no especificado',
            destino: vueloObj.destino || r.destino || 'Destino no especificado',
            duracion: vueloObj.duracion || vueloObj.duracionVuelo || r.duracion || '02h 30m',
            fechaSalida: vueloObj.fechaSalida || vueloObj.fecha || r.fecha_salida || new Date().toISOString(),
            fechaLlegada: vueloObj.fechaLlegada || r.fecha_llegada || new Date().toISOString()
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