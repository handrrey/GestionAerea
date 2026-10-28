import { Component, OnInit, ChangeDetectorRef, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router'; // 👈 Inyectamos Router
import { CompraReservaService } from '../../../nucleo/servicios/compra-reserva';
import { CompraReserva, PasajeroForm } from '../../../nucleo/modelos/compra-reserva.model';

@Component({
  selector: 'app-compra-reserva',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './compra-reserva.html',
  styleUrls: ['./compra-reserva.css']
})
export class CompraReservaComponent implements OnInit {

  private router = inject(Router); // 👈 Inyección de Router
  private compraReservaService = inject(CompraReservaService);
  private cdr = inject(ChangeDetectorRef);

  Math = Math;

  // Vuelo seleccionado (Con fallback por defecto)
  @Input() vuelo: any = {
    idVuelo: 101,
    codigo: 'AV-101',
    tipo: 'INTERNACIONAL',
    origen: 'Bogotá (BOG)',
    destino: 'Madrid (MAD)',
    duracion: '10h 15m',
    fechaSalida: '2026-11-15T14:00:00',
    fechaLlegada: '2026-11-16T06:15:00',
    precioBase: 3500000
  };

  // Datos de Sesión
  idUsuario: number = 0;
  rolUsuario: string = 'VISITANTE';

  // Visibilidad de Modales y Pestañas
  mostrarDetalleModal: boolean = false;
  mostrarCompraReservaPestana: boolean = true; // 🟢 Inicia en true para renderizar la pantalla

  // Mensajes de la Interfaz
  mensajeError: string = '';
  mensajeExito: string = '';

  // Parámetros de la Operación
  cantidadPasajeros: number = 1;
  claseSeleccionada: 'ECONOMICA' | 'PRIMERA_CLASE' = 'ECONOMICA';
  pasajeros: PasajeroForm[] = [];

  // Expiración calculada para la reserva
  fechaLimitePagoCalculada: Date = new Date();

  ngOnInit(): void {
    // 🟢 1. Capturamos el vuelo pasado desde el buscador/lista de vuelos
    const navData = this.router.getCurrentNavigation()?.extras?.state?.['vuelo'] || history.state?.vuelo;

    if (navData) {
      this.vuelo = {
        idVuelo: navData.id || navData.idVuelo || navData.id_vuelo || 101,
        codigo: navData.codigo || navData.codigoVuelo || navData.codigo_vuelo || 'GA-000',
        tipo: navData.tipo || (navData.destino?.toLowerCase().includes('mad') || navData.destino?.toLowerCase().includes('mia') ? 'INTERNACIONAL' : 'NACIONAL'),
        origen: navData.origen || 'Origen no especificado',
        destino: navData.destino || 'Destino no especificado',
        duracion: navData.duracionVuelo || navData.duracion || '02h 30m',
        fechaSalida: navData.fecha ? `${navData.fecha}T${navData.horaVuelo || '08:00:00'}` : new Date().toISOString(),
        fechaLlegada: navData.fecha ? `${navData.fecha}T${navData.horaVuelo || '12:00:00'}` : new Date().toISOString(),
        precioBase: Number(navData.precioEconomico || navData.precioBase || navData.costoEconomico || 350000)
      };
    }

    this.obtenerSesionUsuario();
    this.actualizarFechaLimite();
    this.actualizarCantidadPasajeros();

    // 🟢 2. Forzamos renderizado visual inmediato
    this.mostrarCompraReservaPestana = true;
    this.cdr.detectChanges();
  }

  private obtenerSesionUsuario(): void {
    try {
      const sesionStr = localStorage.getItem('app_usuario_actual');
      if (sesionStr) {
        const usuario = JSON.parse(sesionStr);
        this.idUsuario = Number(usuario.id_usuario || usuario.idUsuario || 0);
        this.rolUsuario = String(usuario.rol || 'VISITANTE').toUpperCase();
      }
    } catch (e) {
      this.rolUsuario = 'VISITANTE';
    }
  }

  private actualizarFechaLimite(): void {
    const hoy = new Date();
    hoy.setHours(hoy.getHours() + 24);
    this.fechaLimitePagoCalculada = hoy;
  }

  // Primer paso: Seleccionar / Reservar en la lista
  alTocarSeleccionarReserva(): void {
    this.mensajeError = '';

    if (this.rolUsuario === 'VISITANTE' || !this.idUsuario) {
      this.mensajeError = 'Debe ser cliente registrado para hacer reservas o compras.';
      this.cdr.detectChanges();
      return;
    }

    this.mostrarDetalleModal = true;
    this.cdr.detectChanges();
  }

  // Transición al Formulario Principal
  irAFormularioCompraReserva(): void {
    this.mostrarDetalleModal = false;
    this.mostrarCompraReservaPestana = true;
    this.cdr.detectChanges();
  }

  // Manejo de la cantidad de pasajeros (1 a 5 máximo)
  actualizarCantidadPasajeros(): void {
    if (this.cantidadPasajeros > 5) this.cantidadPasajeros = 5;
    if (this.cantidadPasajeros < 1) this.cantidadPasajeros = 1;

    while (this.pasajeros.length < this.cantidadPasajeros) {
      this.pasajeros.push({
        nombreCompleto: '',
        documento: '',
        email: '',
        telefono: '',
        edad: 18
      });
    }

    if (this.pasajeros.length > this.cantidadPasajeros) {
      this.pasajeros = this.pasajeros.slice(0, this.cantidadPasajeros);
    }

    this.cdr.detectChanges();
  }

  // Obtener capacidades del avión
  obtenerCapacidadAsientos(): { total: number; economicos: number; primeraClase: number } {
    const esNacional = this.vuelo.tipo === 'NACIONAL';
    return {
      total: esNacional ? 150 : 250,
      economicos: esNacional ? 125 : 200,
      primeraClase: esNacional ? 25 : 50
    };
  }

  // Cálculo del monto total
  calcularMontoTotal(): number {
    const factorClase = this.claseSeleccionada === 'PRIMERA_CLASE' ? 1.4 : 1.0;
    return Math.round(this.vuelo.precioBase * factorClase * this.cantidadPasajeros);
  }

  // Validaciones del formulario de pasajeros y edades
  validarPasajeros(): boolean {
    this.mensajeError = '';

    for (let i = 0; i < this.pasajeros.length; i++) {
      const p = this.pasajeros[i];
      if (!p.nombreCompleto.trim() || !p.documento.trim() || !p.email.trim() || !p.telefono.trim()) {
        this.mensajeError = `Por favor completa todos los datos del Pasajero ${i + 1}.`;
        return false;
      }
      if (p.edad < 0 || isNaN(p.edad)) {
        this.mensajeError = `Ingresa una edad válida para el Pasajero ${i + 1}.`;
        return false;
      }
    }

    // Regla de Edad: Debe haber al menos un adulto mayor de 18 años
    const adultos = this.pasajeros.filter(p => p.edad >= 18);
    if (adultos.length === 0) {
      this.mensajeError = 'Los menores de edad no pueden viajar solos. Debe haber al menos un adulto (mayor de 18 años) acompañante.';
      return false;
    }

    return true;
  }

  // Confirmar la reserva de 24 horas
  confirmarReserva24H(): void {
    if (!this.validarPasajeros()) {
      this.cdr.detectChanges();
      return;
    }

    const codigoGenerado = 'RSV-' + Math.random().toString(36).substring(2, 7).toUpperCase();

    const payload: CompraReserva = {
      codigoReserva: codigoGenerado,
      idUsuario: this.idUsuario,
      montoTotal: this.calcularMontoTotal(),
      estado: 'Pendiente',
      metodoPago: 'Billetera',
      fechaReserva: new Date().toISOString(),
      fechaLimitePago: this.fechaLimitePagoCalculada.toISOString(),
      idVuelo: Number(this.vuelo.idVuelo)
    };

    this.compraReservaService.crearReserva(payload).subscribe({
      next: () => {
        this.mensajeExito = `¡Reserva confirmada con éxito! Código: ${codigoGenerado}. Tienes 24 horas para realizar el pago.`;
        this.cdr.detectChanges();
        setTimeout(() => {
          this.mostrarCompraReservaPestana = false;
        }, 3000);
      },
      error: (err: any) => {
        console.error('Error al registrar la reserva:', err);
        this.mensajeError = err?.error?.message || 'Error al procesar la reserva.';
        this.cdr.detectChanges();
      }
    });
  }
}