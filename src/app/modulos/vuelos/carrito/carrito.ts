import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CompraReservaService } from '../../../nucleo/servicios/compra-reserva';
import { BilleteraService } from '../../../nucleo/servicios/billetera-virtual';
import { PasajeroForm } from '../../../nucleo/modelos/compra-reserva.model';

@Component({
  selector: 'app-carrito',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './carrito.html',
  styleUrls: ['./carrito.css']
})
export class CarritoComponent implements OnInit {

  private router = inject(Router);
  private reservaService = inject(CompraReservaService);
  private billeteraService = inject(BilleteraService);
  private cdr = inject(ChangeDetectorRef);

  idUsuario: number = 0;
  saldoBilletera: number = 0;
  tarjetaUsuario: string = '**** 8765'; // Fallback real observado en la billetera
  tipoTarjeta: string = 'Visa (Crédito)';
  
  itemsCarrito: any[] = [];
  metodoPagoSeleccionado: 'Billetera' | 'Tarjeta' = 'Billetera';

  mensajeError: string = '';
  mensajeExito: string = '';
  procesando: boolean = false;

  ngOnInit(): void {
    this.obtenerSesionUsuario();
    this.cargarCarritoLocalStorage();
    this.consultarDatosBilleteraYTarjetas();
  }

  private obtenerSesionUsuario(): void {
    try {
      const sesionStr = localStorage.getItem('app_usuario_actual');
      if (sesionStr) {
        const u = JSON.parse(sesionStr);
        this.idUsuario = Number(u.id_usuario || u.idUsuario || 0);
      }
    } catch (e) {
      console.error('Error al leer sesión de usuario:', e);
    }
  }

  cargarCarritoLocalStorage(): void {
    try {
      const carritoStr = localStorage.getItem('app_carrito_vuelos');
      this.itemsCarrito = carritoStr ? JSON.parse(carritoStr) : [];
      this.cdr.detectChanges();
    } catch (e) {
      this.itemsCarrito = [];
    }
  }

  consultarDatosBilleteraYTarjetas(): void {
    if (!this.idUsuario) return;

    this.billeteraService.obtenerSaldo(this.idUsuario).subscribe({
      next: (res: any) => {
        console.log('>>> RESPUESTA BILLETERA BACKEND:', res);

        // Si la respuesta trae la propiedad saldo o saldo_actual
        const saldoRespuesta = 
          res?.saldo ?? 
          res?.saldo_actual ?? 
          res?.saldoActual ?? 
          res?.billetera?.saldo ?? 
          res?.monto ?? 
          0;

        this.saldoBilletera = Number(saldoRespuesta);

        // Extracción de tarjeta si viene asociada en la respuesta
        const listaTarjetas = res?.tarjetas || res?.billetera?.tarjetas || [];
        if (Array.isArray(listaTarjetas) && listaTarjetas.length > 0) {
          const t = listaTarjetas[0];
          const num = String(t.numero_tarjeta || t.numeroTarjeta || t.numero || '8765');
          this.tarjetaUsuario = `**** ${num.slice(-4)}`;
          this.tipoTarjeta = t.tipo || t.franquicia || 'Visa (Crédito)';
        } else {
          this.tarjetaUsuario = '**** 8765';
          this.tipoTarjeta = 'Visa (Crédito)';
        }

        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Error al consultar saldo de la billetera:', err);
        this.cdr.detectChanges();
      }
    });
  }

  obtenerMontoTotalCarrito(): number {
    return this.itemsCarrito.reduce((total, item) => total + Number(item.montoTotal || 0), 0);
  }

  eliminarDelCarrito(index: number): void {
    this.itemsCarrito.splice(index, 1);
    localStorage.setItem('app_carrito_vuelos', JSON.stringify(this.itemsCarrito));
    this.cdr.detectChanges();
  }

  vaciarCarrito(): void {
    this.itemsCarrito = [];
    localStorage.removeItem('app_carrito_vuelos');
    this.cdr.detectChanges();
  }

  procesarPagoDirecto(): void {
    this.mensajeError = '';
    this.mensajeExito = '';

    if (this.itemsCarrito.length === 0) {
      this.mensajeError = 'Tu carrito está vacío.';
      return;
    }

    const totalPagar = this.obtenerMontoTotalCarrito();

    if (this.metodoPagoSeleccionado === 'Billetera' && this.saldoBilletera < totalPagar) {
      this.mensajeError = 'Saldo insuficiente en tu billetera virtual para completar la transacción.';
      this.cdr.detectChanges();
      return;
    }

    this.procesando = true;

    // Procesamos el item actual conservando la lista completa de pasajeros y parámetros
    const itemActual = this.itemsCarrito[0];
    const codigoCompra = 'CMP-' + Math.random().toString(36).substring(2, 7).toUpperCase();

    // 🟢 Extraemos y limpiamos los pasajeros capturados previamente en compra-reserva
    const pasajerosRecopilados: PasajeroForm[] = (itemActual.pasajeros || []).map((p: any) => ({
      nombreCompleto: (p.nombreCompleto || `${p.nombre || ''} ${p.apellido || ''}`).trim(),
      documento: String(p.documento || p.dni || '').trim(),
      fechaNacimiento: String(p.fechaNacimiento || '').trim(),
      genero: String(p.genero || 'Masculino').trim(),
      telefono: String(p.telefono || '').trim(),
      email: String(p.email || p.correo || '').trim(),
      nombreContacto: String(p.nombreContacto || p.nombreContactoEmergencia || '').trim(),
      telefonoContacto: String(p.telefonoContacto || p.telefonoContactoEmergencia || '').trim(),
      edad: Number(p.edad || 18)
    }));

    // 🟢 Payload completo enviado al backend NestJS
    const payload: any = {
      codigoReserva: codigoCompra,
      idUsuario: Number(this.idUsuario),
      montoTotal: Number(totalPagar),
      estado: 'Pagado',
      metodoPago: this.metodoPagoSeleccionado,
      fechaReserva: new Date().toISOString(),
      fechaPago: new Date().toISOString(),
      idVuelo: Number(itemActual.vuelo?.idVuelo || itemActual.vuelo?.id || 101),
      clase: itemActual.clase || 'ECONOMICA',
      cantidadPasajeros: pasajerosRecopilados.length || itemActual.cantidadPasajeros || 1,
      pasajeros: pasajerosRecopilados
    };

    console.log('>>> ENVIANDO COMPRA DESDE CARRITO AL BACKEND:', payload);

    this.reservaService.crearReserva(payload).subscribe({
      next: () => {
        this.procesando = false;
        this.mensajeExito = `¡Compra realizada con éxito! Código de confirmación: ${codigoCompra}. Pasabordos generados.`;
        this.vaciarCarrito();
        this.cdr.detectChanges();
        
        setTimeout(() => {
          this.router.navigate(['/perfil']);
        }, 2500);
      },
      error: (err: any) => {
        this.procesando = false;
        console.error('Error al procesar la compra:', err);
        this.mensajeError = err?.error?.message || 'Ocurrió un error al procesar el pago.';
        this.cdr.detectChanges();
      }
    });
  }
}