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
          id_tarjeta: t.id_tarjeta || t.idTarjeta,
          id_billetera: t.id_billetera || t.idBilletera,
          numero_tarjeta: t.numero_tarjeta || t.numeroTarjeta || '',
          tipo_tarjeta: t.tipo_tarjeta || t.tipoTarjeta || 'Débito',
          franquicia: t.franquicia || 'Visa',
          fecha_expiracion: typeof t.fecha_expiracion === 'string' 
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
    if (!this.nuevaTarjeta.numeroTarjeta || !this.nuevaTarjeta.fechaExpiracion) {
      this.mensajeError = 'Por favor completa los campos de la tarjeta.';
      return;
    }

    const payload = {
      idBilletera: this.idBilletera,
      ...this.nuevaTarjeta
    };

    this.billeteraService.agregarTarjeta(this.idUsuario, payload).subscribe({
      next: () => {
        this.mensajeExito = 'Tarjeta guardada con éxito.';
        this.mostrarModalAgregarTarjeta = false;
        this.nuevaTarjeta = { numeroTarjeta: '', tipoTarjeta: 'Crédito', franquicia: 'Visa', fechaExpiracion: '' };
        this.cargarDatosBilletera();
      },
      error: (err: any) => {
        console.error('Error al agregar tarjeta:', err);
        this.mensajeError = 'No se pudo guardar la tarjeta.';
      }
    });
  }

  eliminarTarjeta(idTarjeta?: number): void {
    if (!idTarjeta) return;
    if (confirm('¿Deseas eliminar esta tarjeta?')) {
      this.billeteraService.eliminarTarjeta(idTarjeta).subscribe({
        next: () => {
          this.mensajeExito = 'Tarjeta eliminada de la billetera.';
          this.cargarDatosBilletera();
        },
        error: (err: any) => {
          console.error('Error al eliminar:', err);
          this.mensajeError = 'Error al eliminar la tarjeta.';
        }
      });
    }
  }
}