import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { BilleteraService } from '../../../nucleo/servicios/billetera-virtual';
import { Tarjeta, Transaccion } from '../../../nucleo/modelos/billetera-virtual.model';

@Component({
  selector: 'app-billetera-virtual',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './billetera-virtual.html',
  styleUrls: ['./billetera-virtual.css']
})
export class BilleteraVirtualComponent implements OnInit {

  private billeteraService = inject(BilleteraService);
  private cdr = inject(ChangeDetectorRef);

  Math = Math;

  idUsuario: number = 1;
  idBilletera: number = 0;
  saldo: number = 0;
  tarjetas: Tarjeta[] = [];
  historial: Transaccion[] = [];

  cargando: boolean = true;
  verHistorial: boolean = true;
  mensajeExito: string = '';
  mensajeError: string = '';

  // Controladores de Modales
  mostrarModalRecarga: boolean = false;
  mostrarModalAgregarTarjeta: boolean = false;
  mostrarModalEliminarTarjeta: boolean = false;
  mostrarModalConsultarTarjetas: boolean = false;

  montoRecarga: number = 50000;
  tarjetaSeleccionadaId: number | null = null;

  nuevaTarjeta: Omit<Tarjeta, 'idTarjeta' | 'idBilletera'> = {
    numeroTarjeta: '',
    tipoTarjeta: 'Crédito',
    franquicia: 'Visa',
    fechaExpiracion: ''
  };

  ngOnInit(): void {
    this.cargarDatosBilletera();
  }

  toggleHistorial(): void {
    this.verHistorial = !this.verHistorial;
  }

  abrirModalAgregarTarjeta(): void {
    this.mostrarModalAgregarTarjeta = true;
  }

  cargarDatosBilletera(): void {
    this.cargando = true;
    this.billeteraService.obtenerEstadoBilletera(this.idUsuario).subscribe({
      next: (data: any) => {
        const b = data.billetera || data;
        this.idBilletera = b.id_billetera || b.idBilletera || 0;
        this.saldo = Number(b.saldo || 0);

        this.tarjetas = (data.tarjetas || []).map((t: any) => ({
          idTarjeta: t.id_tarjeta || t.idTarjeta,
          idBilletera: t.id_billetera || t.idBilletera,
          numeroTarjeta: t.numero_tarjeta || t.numeroTarjeta || '',
          tipoTarjeta: t.tipo_tarjeta || t.tipoTarjeta || 'Débito',
          franquicia: t.franquicia || 'Visa',
          fechaExpiracion: typeof t.fecha_expiracion === 'string' 
            ? t.fecha_expiracion.split('T')[0] 
            : t.fecha_expiracion
        }));

        this.historial = data.historial || [];
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Error al cargar la billetera:', err);
        this.mensajeError = 'No se pudo obtener el estado de la billetera.';
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  procesarRecarga(): void {
    if (!this.montoRecarga || this.montoRecarga <= 0) {
      this.mensajeError = 'Ingresa un monto válido para añadir.';
      return;
    }

    const idTarjeta = this.tarjetaSeleccionadaId || (this.tarjetas[0]?.idTarjeta || 0);

    this.billeteraService.recargarSaldo(this.idUsuario, this.montoRecarga, idTarjeta).subscribe({
      next: () => {
        this.mensajeExito = '¡Saldo añadido con éxito!';
        this.mostrarModalRecarga = false;
        this.cargarDatosBilletera();
      },
      error: (err: any) => {
        console.error('Error al añadir saldo:', err);
        this.mensajeError = 'Error al procesar la recarga.';
      }
    });
  }

  guardarTarjeta(): void {
    this.mensajeError = '';
    this.mensajeExito = '';

    const numTarjeta = String(this.nuevaTarjeta.numeroTarjeta || '').trim();
    const fechaExp = String(this.nuevaTarjeta.fechaExpiracion || '').trim();

    // 1. Validar que los campos no estén vacíos
    if (!numTarjeta || !fechaExp) {
      this.mensajeError = 'Por favor completa todos los campos de la tarjeta.';
      this.cdr.detectChanges();
      return;
    }

    // 2. Validaciones del número de tarjeta (Exactamente 16 dígitos numéricos)
    const soloNumeros = /^\d+$/;
    if (numTarjeta.length !== 16 || !soloNumeros.test(numTarjeta)) {
      this.mensajeError = 'Tarjeta invalida. Debe tener 16 digitos.';
      this.cdr.detectChanges();
      return;
    }

    // 3. Validar estructura de la fecha de expiración (Formato MM/AA)
    const formatoFecha = /^(0[1-9]|1[0-2])\/\d{2}$/;
    if (!formatoFecha.test(fechaExp)) {
      const partes = fechaExp.split('/');
      if (partes.length === 2 && soloNumeros.test(partes[0]) && soloNumeros.test(partes[1])) {
        const mesAux = parseInt(partes[0], 10);
        if (mesAux < 1 || mesAux > 12) {
          this.mensajeError = 'Fecha inexistente.';
          this.cdr.detectChanges();
          return;
        }
      }
      this.mensajeError = 'Estructura incorrecta de fehca de expiracion. Debe ser xx/xx.';
      this.cdr.detectChanges();
      return;
    }

    // 4. Extracción de mes y año
    const [mesStr, anioStr] = fechaExp.split('/');
    const mesTarjeta = parseInt(mesStr, 10);
    const anioTarjeta = 2000 + parseInt(anioStr, 10);

    if (mesTarjeta < 1 || mesTarjeta > 12) {
      this.mensajeError = 'Fecha inexistente.';
      this.cdr.detectChanges();
      return;
    }

    // 5. Validación de vigencia (Mes/Año actual y límite de 5 años)
    const hoy = new Date();
    const anioActual = hoy.getFullYear();
    const mesActual = hoy.getMonth() + 1;

    if (anioTarjeta < anioActual || (anioTarjeta === anioActual && mesTarjeta < mesActual)) {
      this.mensajeError = 'Tarjeta expirada.';
      this.cdr.detectChanges();
      return;
    }

    const anioMaximo = anioActual + 5;
    if (
      anioTarjeta > anioMaximo || 
      (anioTarjeta === anioMaximo && mesTarjeta > mesActual)
    ) {
      this.mensajeError = 'Fecha imposible. La tarjetas son maximo por 5 años.';
      this.cdr.detectChanges();
      return;
    }

    // Payload estricto en camelCase para el ValidationPipe de NestJS
    const payload = {
      idBilletera: this.idBilletera,
      numeroTarjeta: numTarjeta,
      tipoTarjeta: this.nuevaTarjeta.tipoTarjeta || 'Crédito',
      franquicia: this.nuevaTarjeta.franquicia || 'Visa',
      fechaExpiracion: fechaExp
    };

    this.billeteraService.agregarTarjeta(this.idUsuario, payload).subscribe({
      next: () => {
        this.mensajeExito = 'Tarjeta guardada con éxito.';
        this.mostrarModalAgregarTarjeta = false;
        
        // Reinicio limpio del formulario
        this.nuevaTarjeta = {
          numeroTarjeta: '',
          tipoTarjeta: 'Crédito',
          franquicia: 'Visa',
          fechaExpiracion: ''
        };

        this.cargarDatosBilletera();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Error al agregar tarjeta:', err);
        this.mensajeError = err?.error?.message || 'No se pudo guardar la tarjeta.';
        this.cdr.detectChanges();
      }
    });
  }

  eliminarTarjeta(tarjeta: Tarjeta): void {
    const idAEliminar = Number(tarjeta.idTarjeta);

    if (!idAEliminar || isNaN(idAEliminar)) {
      this.mensajeError = 'No se pudo identificar la tarjeta a eliminar.';
      this.cdr.detectChanges();
      return;
    }

    if (confirm('¿Deseas eliminar esta tarjeta de tu billetera?')) {
      this.billeteraService.eliminarTarjeta(idAEliminar, this.idUsuario).subscribe({
        next: () => {
          this.mensajeExito = 'Tarjeta eliminada con éxito.';
          this.cargarDatosBilletera();
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          console.error('Error al eliminar la tarjeta:', err);
          this.mensajeError = err?.error?.message || 'Error al procesar la eliminación de la tarjeta.';
          this.cdr.detectChanges();
        }
      });
    }
  }
}