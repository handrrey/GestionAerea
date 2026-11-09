import { Component, OnInit, ChangeDetectorRef, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
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

  private router = inject(Router);
  private compraReservaService = inject(CompraReservaService);
  private cdr = inject(ChangeDetectorRef);

  Math = Math;

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

  idUsuario: number = 0;
  rolUsuario: string = 'VISITANTE';

  mostrarDetalleModal: boolean = false;
  mostrarCompraReservaPestana: boolean = true;

  mensajeError: string = '';
  mensajeExito: string = '';

  cantidadPasajeros: number = 1;
  claseSeleccionada: 'ECONOMICA' | 'PRIMERA_CLASE' = 'ECONOMICA';
  pasajeros: PasajeroForm[] = [];

  // 🟢 Propiedades declaradas para enlazar con [min] y [max] en el HTML
  fechaLimitePagoCalculada: Date = new Date();
  fechaMinimaNacimiento: string = '';
  fechaMaximaNacimiento: string = '';

  ngOnInit(): void {
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
    this.configurarLimitesFechasNacimiento();
    this.actualizarCantidadPasajeros();

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

  private configurarLimitesFechasNacimiento(): void {
    const hoy = new Date();
    const min = new Date(hoy.getFullYear() - 100, hoy.getMonth(), hoy.getDate());
    this.fechaMaximaNacimiento = hoy.toISOString().split('T')[0];
    this.fechaMinimaNacimiento = min.toISOString().split('T')[0];
  }

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

  irAFormularioCompraReserva(): void {
    this.mostrarDetalleModal = false;
    this.mostrarCompraReservaPestana = true;
    this.cdr.detectChanges();
  }

  actualizarCantidadPasajeros(): void {
    if (this.cantidadPasajeros > 5) this.cantidadPasajeros = 5;
    if (this.cantidadPasajeros < 1) this.cantidadPasajeros = 1;

    while (this.pasajeros.length < this.cantidadPasajeros) {
      this.pasajeros.push({
        nombreCompleto: '',
        documento: '',
        fechaNacimiento: '',
        genero: '',
        telefono: '',
        email: '',
        nombreContacto: '',
        telefonoContacto: '',
        edad: 18
      });
    }

    if (this.pasajeros.length > this.cantidadPasajeros) {
      this.pasajeros = this.pasajeros.slice(0, this.cantidadPasajeros);
    }

    this.cdr.detectChanges();
  }

  obtenerCapacidadAsientos(): { total: number; economicos: number; primeraClase: number } {
    const esNacional = this.vuelo.tipo === 'NACIONAL';
    return {
      total: esNacional ? 150 : 250,
      economicos: esNacional ? 125 : 200,
      primeraClase: esNacional ? 25 : 50
    };
  }

  calcularMontoTotal(): number {
    const factorClase = this.claseSeleccionada === 'PRIMERA_CLASE' ? 1.4 : 1.0;
    return Math.round(this.vuelo.precioBase * factorClase * this.cantidadPasajeros);
  }

  validarPasajeros(): boolean {
    this.mensajeError = '';
    const regexDocumento = /^\d{8,10}$/;
    const regexTelefono = /^\d{10}$/;
    const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    let totalAdultos = 0;

    for (let i = 0; i < this.pasajeros.length; i++) {
      const p = this.pasajeros[i];
      const numPasajero = i + 1;

      if (!p.nombreCompleto || p.nombreCompleto.trim() === '') {
        this.mensajeError = `El nombre completo del Pasajero ${numPasajero} no puede estar vacío.`;
        return false;
      }
      if (!p.documento || p.documento.trim() === '') {
        this.mensajeError = `El documento del Pasajero ${numPasajero} no puede estar vacío.`;
        return false;
      }
      if (!regexDocumento.test(p.documento.trim())) {
        this.mensajeError = `Documento inválido en el Pasajero ${numPasajero}. Debe tener obligatoriamente entre 8 y 10 dígitos.`;
        return false;
      }
      if (!p.fechaNacimiento || p.fechaNacimiento.trim() === '') {
        this.mensajeError = `La fecha de nacimiento del Pasajero ${numPasajero} es requerida.`;
        return false;
      }

      const edadCalculada = this.calcularEdad(p.fechaNacimiento);
      if (edadCalculada < 0 || edadCalculada > 100 || isNaN(edadCalculada)) {
        this.mensajeError = `Fecha de nacimiento inválida para el Pasajero ${numPasajero}. No puede ser mayor de 100 años.`;
        return false;
      }

      p.edad = edadCalculada;
      if (edadCalculada >= 18) totalAdultos++;

      if (!p.genero || p.genero.trim() === '') {
        this.mensajeError = `Selecciona el género del Pasajero ${numPasajero}.`;
        return false;
      }
      if (!p.telefono || p.telefono.trim() === '') {
        this.mensajeError = `El teléfono del Pasajero ${numPasajero} no puede estar vacío.`;
        return false;
      }
      if (!regexTelefono.test(p.telefono.trim())) {
        this.mensajeError = `El teléfono del Pasajero ${numPasajero} es inválido. Debe tener obligatoriamente 10 dígitos.`;
        return false;
      }
      if (!p.email || p.email.trim() === '') {
        this.mensajeError = `El correo electrónico del Pasajero ${numPasajero} no puede estar vacío.`;
        return false;
      }
      if (!regexEmail.test(p.email.trim())) {
        this.mensajeError = `El correo electrónico del Pasajero ${numPasajero} es inválido.`;
        return false;
      }
      if (!p.nombreContacto || p.nombreContacto.trim() === '') {
        this.mensajeError = `El nombre de contacto del Pasajero ${numPasajero} no puede estar vacío.`;
        return false;
      }
      if (!p.telefonoContacto || p.telefonoContacto.trim() === '') {
        this.mensajeError = `El teléfono de contacto del Pasajero ${numPasajero} no puede estar vacío.`;
        return false;
      }
      if (!regexTelefono.test(p.telefonoContacto.trim())) {
        this.mensajeError = `El teléfono de contacto del Pasajero ${numPasajero} es inválido. Debe tener obligatoriamente 10 dígitos.`;
        return false;
      }
    }

    if (totalAdultos === 0) {
      this.mensajeError = '⚠️ Un menor de edad no puede viajar solo. Debe haber al menos un pasajero adulto (mayor de 18 años) en el grupo.';
      return false;
    }

    return true;
  }

  private calcularEdad(fechaNacimientoStr: string): number {
    const fechaNac = new Date(fechaNacimientoStr);
    const hoy = new Date();
    if (isNaN(fechaNac.getTime())) return -1;
    let edad = hoy.getFullYear() - fechaNac.getFullYear();
    const mes = hoy.getMonth() - fechaNac.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNac.getDate())) {
      edad--;
    }
    return edad;
  }

  anadirAlCarrito(): void {
    if (!this.validarPasajeros()) {
      this.cdr.detectChanges();
      return;
    }

    const itemCarrito = {
      vuelo: this.vuelo,
      pasajeros: this.pasajeros,
      clase: this.claseSeleccionada,
      montoTotal: this.calcularMontoTotal(),
      fechaAgregado: new Date().toISOString()
    };

    try {
      const carritoActual = JSON.parse(localStorage.getItem('app_carrito_vuelos') || '[]');
      carritoActual.push(itemCarrito);
      localStorage.setItem('app_carrito_vuelos', JSON.stringify(carritoActual));

      this.mensajeExito = '¡Vuelo añadido al carrito de compras con éxito! 🛒';
      this.mostrarDetalleModal = false;
      this.cdr.detectChanges();
    } catch (e) {
      this.mensajeError = 'Error al guardar la selección en el carrito.';
      this.cdr.detectChanges();
    }
  }

  confirmarReserva24H(): void {
    if (!this.validarPasajeros()) {
      this.cdr.detectChanges();
      return;
    }

    const codigoGenerado = 'RSV-' + Math.random().toString(36).substring(2, 7).toUpperCase();

    // 🟢 Mapeo corregido con las llaves exactas 'nombreContacto' y 'telefonoContacto'
    const pasajerosLimpios: PasajeroForm[] = this.pasajeros.map(p => ({
      nombreCompleto: p.nombreCompleto.trim(),
      documento: p.documento.trim(),
      fechaNacimiento: p.fechaNacimiento.trim(),
      genero: p.genero.trim(),
      telefono: p.telefono.trim(),
      email: p.email.trim(),
      nombreContacto: p.nombreContacto.trim(),
      telefonoContacto: p.telefonoContacto.trim(),
      edad: p.edad
    }));

    const payload: CompraReserva = {
      codigoReserva: codigoGenerado,
      idUsuario: Number(this.idUsuario),
      montoTotal: this.calcularMontoTotal(),
      estado: 'RESERVADO',
      metodoPago: 'Billetera',
      fechaReserva: new Date().toISOString(),
      fechaLimitePago: this.fechaLimitePagoCalculada.toISOString(),
      idVuelo: Number(this.vuelo.idVuelo || this.vuelo.id || 101),
      clase: this.claseSeleccionada,
      cantidadPasajeros: this.cantidadPasajeros,
      pasajeros: pasajerosLimpios
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