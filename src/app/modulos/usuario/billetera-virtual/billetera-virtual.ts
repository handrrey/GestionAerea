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

  idUsuario: number = 0;
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
    franquicia: '',
    fechaExpiracion: ''
  };

  franquiciaDetectada: string = '';
  errorFranquicia: string = '';

  ngOnInit(): void {
    this.obtenerUsuarioAutenticado();
    this.cargarDatosBilletera();
  }

  toggleHistorial(): void {
    this.verHistorial = !this.verHistorial;
  }

  abrirModalAgregarTarjeta(): void {
    this.mensajeError = '';
    this.mensajeExito = '';
    this.nuevaTarjeta = {
      numeroTarjeta: '',
      tipoTarjeta: 'Crédito',
      franquicia: '',
      fechaExpiracion: ''
    };
    this.franquiciaDetectada = '';
    this.errorFranquicia = '';
    this.mostrarModalAgregarTarjeta = true;
  }

  /**
   * Detecta automáticamente la franquicia según los dígitos iniciales ingresados
   */
  detectarFranquiciaPorNumero(numeroRaw: string): string {
    const num = String(numeroRaw || '').replace(/\D/g, '');
    if (!num) return '';

    // 1. Visa: Comienza por 4
    if (num.startsWith('4')) {
      return 'Visa';
    }

    // 2. American Express: 34 o 37
    if (/^3[47]/.test(num)) {
      return 'American Express';
    }

    // 3. Diners Club: 300-305, 36 o 38
    if (/^(30[0-5]|36|38)/.test(num)) {
      return 'Diners Club';
    }

    // 4. Maestro: 50, 56-58 o 67 (evaluado antes de Mastercard y Discover)
    if (/^(50|5[6-8]|67)/.test(num)) {
      return 'Maestro';
    }

    // 5. Mastercard: 51-55 o rango 2221-2720
    if (/^5[1-5]/.test(num)) {
      return 'Mastercard';
    }
    if (num.length >= 4) {
      const primerosCuatro = parseInt(num.slice(0, 4), 10);
      if (primerosCuatro >= 2221 && primerosCuatro <= 2720) {
        return 'Mastercard';
      }
    } else if (num.startsWith('2')) {
      // Mientras escribe los primeros 2-3 dígitos del rango 2221-2720
      const prefijo = parseInt(num, 10);
      if (num.length === 1 && prefijo === 2) return 'Mastercard';
      if (num.length === 2 && prefijo >= 22 && prefijo <= 27) return 'Mastercard';
      if (num.length === 3 && prefijo >= 222 && prefijo <= 272) return 'Mastercard';
    }

    // 6. Discover: 6011, 65 o rango 644-649
    if (/^(6011|65|64[4-9])/.test(num)) {
      return 'Discover';
    }

    return '';
  }

  /**
   * Se ejecuta en tiempo real cada vez que cambia el número de tarjeta
   */
  alCambiarNumeroTarjeta(): void {
    const limpio = String(this.nuevaTarjeta.numeroTarjeta || '').replace(/\D/g, '');
    this.nuevaTarjeta.numeroTarjeta = limpio;

    if (!limpio) {
      this.franquiciaDetectada = '';
      this.nuevaTarjeta.franquicia = '';
      this.errorFranquicia = '';
      return;
    }

    const franquicia = this.detectarFranquiciaPorNumero(limpio);
    if (franquicia) {
      this.franquiciaDetectada = franquicia;
      this.nuevaTarjeta.franquicia = franquicia;
      this.errorFranquicia = '';
    } else {
      this.franquiciaDetectada = '';
      this.nuevaTarjeta.franquicia = '';
      this.errorFranquicia = 'Franquicia no reconocida';
    }
  }

  private obtenerUsuarioAutenticado(): void {
    try {
      const usuarioSesion = localStorage.getItem('app_usuario_actual');
      if (usuarioSesion) {
        const usuarioParsed = JSON.parse(usuarioSesion);
        this.idUsuario = Number(usuarioParsed.id_usuario || usuarioParsed.idUsuario || 0);
      }
    } catch (e) {
      console.error('Error al leer el usuario de la sesión:', e);
    }

    if (!this.idUsuario) {
      this.mensajeError = 'No se encontró una sesión válida de usuario.';
    }
  }

  cargarHistorial(): void {
    if (!this.idUsuario) return;

    this.billeteraService.obtenerHistorial(this.idUsuario).subscribe({
      next: (data: any) => {
        const lista = Array.isArray(data) ? data : (data?.historial || []);

        this.historial = lista.map((h: any) => {
          const descripcion = h.info_historial || h.concepto || h.descripcion || 'Movimiento de Billetera';
          const fechaRaw = h.fecha_transaccion || h.fecha || '';
          const descLower = descripcion.toLowerCase();

          let montoCalculado = Math.abs(Number(h.monto || h.valor || 0));

          const esRecarga = descLower.includes('incremento') ||
                            descLower.includes('recarga') ||
                            descLower.includes('añad');

          const esCompra = descLower.includes('compra') ||
                           descLower.includes('pago') ||
                           descLower.includes('descuento');

          if (montoCalculado === 0) {
            if (esCompra) {
              const matchCompra = descripcion.match(/por\s+(\d+)/i);
              if (matchCompra && matchCompra[1]) {
                montoCalculado = parseInt(matchCompra[1], 10);
              } else {
                const numerosEncontrados = descripcion.match(/\d+/g);
                if (numerosEncontrados && numerosEncontrados.length > 0) {
                  montoCalculado = parseInt(numerosEncontrados[0], 10);
                }
              }
            } else {
              const matchPor = descripcion.match(/por\s+(\d+)/i);
              if (matchPor && matchPor[1]) {
                montoCalculado = parseInt(matchPor[1], 10);
              } else {
                const numerosEncontrados = descripcion.match(/\d+/g);
                if (numerosEncontrados && numerosEncontrados.length > 0) {
                  montoCalculado = parseInt(numerosEncontrados[numerosEncontrados.length - 1], 10);
                }
              }
            }
          }

          return {
            id_transaccion: h.id_historial || h.id_transaccion || h.idTransaccion,
            concepto: descripcion,
            fecha: typeof fechaRaw === 'string' ? fechaRaw.split('T')[0] : fechaRaw,
            monto: montoCalculado,
            tipo: esRecarga ? 'RECARGA' : (esCompra ? 'COMPRA' : 'REEMBOLSO'),
            referencia: `ID #${h.id_historial || h.id_transaccion || 'N/A'}`
          };
        });

        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Error al cargar historial:', err);
        this.historial = [];
        this.cdr.detectChanges();
      }
    });
  }

  cargarDatosBilletera(): void {
    if (!this.idUsuario) return;

    this.cargando = true;
    this.billeteraService.obtenerEstadoBilletera(this.idUsuario).subscribe({
      next: (data: any) => {
        const b = data.billetera || data;
        this.idBilletera = b.id_billetera || b.idBilletera || 0;
        this.saldo = Number(b.saldo || 0);

        this.tarjetas = (data.tarjetas || []).map((t: any) => {
          const num = t.numero_tarjeta || t.numeroTarjeta || '';
          const tipo = t.tipo_tarjeta || t.tipoTarjeta || 'Crédito';
          const exp = t.fecha_expiracion || t.fechaExpiracion || '';

          return {
            id_tarjeta: t.id_tarjeta || t.idTarjeta,
            idTarjeta: t.id_tarjeta || t.idTarjeta,
            id_billetera: t.id_billetera || t.idBilletera,
            numero_tarjeta: num,
            numeroTarjeta: num,
            tipo_tarjeta: tipo,
            tipoTarjeta: tipo,
            franquicia: t.franquicia || this.detectarFranquiciaPorNumero(num) || 'Desconocida',
            fecha_expiracion: typeof exp === 'string' ? exp.split('T')[0] : exp,
            fechaExpiracion: typeof exp === 'string' ? exp.split('T')[0] : exp
          };
        });

        this.cargando = false;
        this.cdr.detectChanges();

        this.cargarHistorial();
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

    // 3. Validar franquicia reconocida automáticamente
    const franquiciaValida = this.detectarFranquiciaPorNumero(numTarjeta);
    if (!franquiciaValida) {
      this.franquiciaDetectada = '';
      this.errorFranquicia = 'Franquicia no reconocida';
      this.mensajeError = 'Franquicia no reconocida. Verifica los primeros dígitos de la tarjeta.';
      this.cdr.detectChanges();
      return;
    }

    this.franquiciaDetectada = franquiciaValida;
    this.nuevaTarjeta.franquicia = franquiciaValida;

    // 4. Validar estructura de la fecha de expiración (Formato MM/AA)
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

    // 5. Extracción de mes y año
    const [mesStr, anioStr] = fechaExp.split('/');
    const mesTarjeta = parseInt(mesStr, 10);
    const anioTarjeta = 2000 + parseInt(anioStr, 10);

    if (mesTarjeta < 1 || mesTarjeta > 12) {
      this.mensajeError = 'Fecha inexistente.';
      this.cdr.detectChanges();
      return;
    }

    // 6. Validación de vigencia (Mes/Año actual y límite de 5 años)
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
      franquicia: franquiciaValida,
      fechaExpiracion: fechaExp
    };

    this.billeteraService.agregarTarjeta(this.idUsuario, payload).subscribe({
      next: () => {
        this.mensajeExito = 'Tarjeta guardada con éxito.';
        this.mostrarModalAgregarTarjeta = false;
        
        this.nuevaTarjeta = {
          numeroTarjeta: '',
          tipoTarjeta: 'Crédito',
          franquicia: '',
          fechaExpiracion: ''
        };
        this.franquiciaDetectada = '';
        this.errorFranquicia = '';

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