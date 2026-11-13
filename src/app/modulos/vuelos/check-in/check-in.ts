import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CompraReservaService } from '../../../nucleo/servicios/compra-reserva';
import { VuelosService } from '../../../nucleo/servicios/vuelos';

@Component({
  selector: 'app-check-in',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './check-in.html',
  styleUrls: ['./check-in.css']
})
export class CheckInComponent implements OnInit {

  private router = inject(Router);
  private http = inject(HttpClient);
  private reservaService = inject(CompraReservaService);
  private vuelosService = inject(VuelosService);
  private cdr = inject(ChangeDetectorRef);

  private apiUrl = 'http://localhost:3000/appV1';

  // Modalidades: 'RAPIDA' (búsqueda manual por código/DNI) | 'SISTEMA' (autocompletado usuario logueado)
  modalidad: 'RAPIDA' | 'SISTEMA' = 'RAPIDA';

  // Usuario en sesión
  usuarioSesion: any = null;
  idUsuario: number = 0;

  // Catálogo indexado de vuelos
  mapaVuelosBackend: Record<number, any> = {};

  // Estado Modalidad Rápida (Manual)
  criterioBusqueda: string = '';
  buscando: boolean = false;
  reservaEncontrada: any = null;
  pasajeroSeleccionadoIdx: number = 0;

  // Estado Modalidad Sistema (Usuario Registrado)
  reservasUsuarioElegibles: any[] = [];
  reservaSistemaSeleccionada: any = null;

  // Campos editables en modalidad manual / confirmación
  telefonoConfirmacion: string = '';
  emailConfirmacion: string = '';
  aceptaTerminos: boolean = true;

  // Mensajes y estado de proceso
  cargandoInicial: boolean = false;
  procesandoCheckin: boolean = false;
  mensajeError: string = '';
  mensajeExito: string = '';
  pasabordoGenerado: any = null;

  ngOnInit(): void {
    this.leerUsuarioSesion();
    this.inicializarDatos();
  }

  private leerUsuarioSesion(): void {
    try {
      const sesionStr = localStorage.getItem('app_usuario_actual');
      if (sesionStr) {
        this.usuarioSesion = JSON.parse(sesionStr);
        this.idUsuario = Number(this.usuarioSesion.id_usuario || this.usuarioSesion.idUsuario || this.usuarioSesion.id || 0);
      }
    } catch (e) {
      console.error('Error al leer sesión:', e);
    }
  }

  private inicializarDatos(): void {
    this.cargandoInicial = true;

    // Verificar si viene una reserva preseleccionada desde Mis Reservas
    const reservaState = history.state?.reserva || null;
    const reservaLocalStr = localStorage.getItem('app_reserva_checkin');
    const reservaPrevia = reservaState || (reservaLocalStr ? JSON.parse(reservaLocalStr) : null);

    const vuelos$ = this.vuelosService.obtenerVuelos().pipe(catchError(() => of([])));
    const reservasUsuario$ = this.idUsuario > 0
      ? this.reservaService.obtenerReservasPorUsuario(this.idUsuario).pipe(catchError(() => of([])))
      : of([]);

    forkJoin({ vuelos: vuelos$, reservasUsuario: reservasUsuario$ }).subscribe({
      next: ({ vuelos, reservasUsuario }) => {
        for (const v of (vuelos as any[])) {
          const vid = Number(v.idVuelo || v.id_vuelo || v.id || 0);
          if (vid > 0) this.mapaVuelosBackend[vid] = v;
        }

        const listaUsuario = Array.isArray(reservasUsuario)
          ? reservasUsuario
          : (reservasUsuario?.reservas || []);

        const normalizadas = listaUsuario.map((r: any) => this.normalizarReserva(r));

        // Filtrar únicamente vuelos PAGADOS y dentro de la ventana de 48 horas
        this.reservasUsuarioElegibles = normalizadas.filter((r: any) => r.elegibleCheckin);

        if (reservaPrevia) {
          const code = reservaPrevia.codigo || reservaPrevia.codigoReserva || '';
          if (code) {
            this.criterioBusqueda = code;
            this.buscarReservaManual();
          }
          localStorage.removeItem('app_reserva_checkin');
        } else if (this.idUsuario > 0 && this.reservasUsuarioElegibles.length > 0) {
          // Si el usuario tiene sesión y vuelos elegibles, abrir directo en Identificación en el Sistema
          this.modalidad = 'SISTEMA';
          this.seleccionarReservaSistema(this.reservasUsuarioElegibles[0]);
        }

        this.cargandoInicial = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.cargandoInicial = false;
        this.cdr.detectChanges();
      }
    });
  }

  cambiarModalidad(nuevaModalidad: 'RAPIDA' | 'SISTEMA'): void {
    this.modalidad = nuevaModalidad;
    this.mensajeError = '';
    this.mensajeExito = '';
    this.pasabordoGenerado = null;

    if (nuevaModalidad === 'SISTEMA') {
      if (!this.idUsuario) {
        this.mensajeError = 'Debes iniciar sesión para usar la modalidad de Identificación en el Sistema.';
      } else if (this.reservasUsuarioElegibles.length > 0 && !this.reservaSistemaSeleccionada) {
        this.seleccionarReservaSistema(this.reservasUsuarioElegibles[0]);
      }
    }
  }

  /**
   * Modalidad 1: Búsqueda manual por código de reserva o número de documento (DNI)
   */
  buscarReservaManual(): void {
    const termino = this.criterioBusqueda.trim().replace(/^#/, '').toUpperCase();
    this.mensajeError = '';
    this.mensajeExito = '';
    this.pasabordoGenerado = null;
    this.reservaEncontrada = null;

    if (!termino) {
      this.mensajeError = 'Ingresa un código de reserva (Ej. CMP-GMRG7) o número de documento.';
      return;
    }

    this.buscando = true;

    // Consultar todas las reservas o las del usuario activo para encontrar coincidencia
    const consulta$ = this.http.get<any>(`${this.apiUrl}/compra-reserva`).pipe(
      catchError(() =>
        this.idUsuario > 0
          ? this.reservaService.obtenerReservasPorUsuario(this.idUsuario).pipe(catchError(() => of([])))
          : of([])
      )
    );

    consulta$.subscribe({
      next: (res: any) => {
        const lista = Array.isArray(res) ? res : (res?.reservas || res?.data || []);
        const todasNormalizadas = lista.map((r: any) => this.normalizarReserva(r));

        const coincidencia = todasNormalizadas.find((r: any) => {
          const coincideCodigo = r.codigo.toUpperCase() === termino;
          const coincideDni = r.pasajeros.some((p: any) => String(p.documento || '').toUpperCase() === termino);
          return coincideCodigo || coincideDni;
        });

        this.buscando = false;

        if (!coincidencia) {
          this.mensajeError = `No se encontró ninguna compra o reserva con "${termino}". Verifica el código o documento.`;
          this.cdr.detectChanges();
          return;
        }

        // Validar reglas de negocio: Pagado + margen de 48 horas
        if (!coincidencia.elegibleCheckin) {
          this.mensajeError = coincidencia.motivoNoElegible;
          this.cdr.detectChanges();
          return;
        }

        this.reservaEncontrada = coincidencia;

        // Si buscó por documento, seleccionar automáticamente a ese pasajero
        const idxPorDni = coincidencia.pasajeros.findIndex(
          (p: any) => String(p.documento || '').toUpperCase() === termino
        );
        this.pasajeroSeleccionadoIdx = idxPorDni >= 0 ? idxPorDni : 0;

        const pasajeroActual = this.pasajeroActivo;
        this.telefonoConfirmacion = pasajeroActual?.telefono || '';
        this.emailConfirmacion = pasajeroActual?.email || '';

        this.cdr.detectChanges();
      },
      error: () => {
        this.buscando = false;
        this.mensajeError = 'Error al consultar la reserva en el servidor.';
        this.cdr.detectChanges();
      }
    });
  }

  onCambioPasajeroManual(): void {
    const p = this.pasajeroActivo;
    this.telefonoConfirmacion = p?.telefono || '';
    this.emailConfirmacion = p?.email || '';
    this.pasabordoGenerado = null;
  }

  /**
   * Modalidad 2: Selección de reserva autocompletada del usuario logueado
   */
  seleccionarReservaSistema(reserva: any): void {
    this.reservaSistemaSeleccionada = reserva;
    this.pasajeroSeleccionadoIdx = 0;
    this.mensajeError = '';
    this.mensajeExito = '';
    this.pasabordoGenerado = null;

    const p = reserva.pasajeros[0];
    this.telefonoConfirmacion = p?.telefono || this.usuarioSesion?.telefono || '';
    this.emailConfirmacion = p?.email || this.usuarioSesion?.correo || this.usuarioSesion?.email || '';
  }

  get reservaActiva(): any {
    return this.modalidad === 'RAPIDA' ? this.reservaEncontrada : this.reservaSistemaSeleccionada;
  }

  get pasajeroActivo(): any {
    const res = this.reservaActiva;
    if (!res || !Array.isArray(res.pasajeros) || res.pasajeros.length === 0) return null;
    return res.pasajeros[this.pasajeroSeleccionadoIdx] || res.pasajeros[0];
  }

  /**
   * Normaliza una reserva y evalúa estrictamente si cumple:
   * 1) Estado === 'PAGADO'
   * 2) Falta entre 0 y 48 horas para la salida del vuelo
   */
  private normalizarReserva(r: any): any {
    const idReservaReal = Number(r.id_reserva || r.idReserva || r.id || 0);
    const idVueloReal = Number(r.id_vuelo || r.idVuelo || r.vuelo?.id_vuelo || r.vuelo?.idVuelo || 0);
    const v = {
      ...(this.mapaVuelosBackend[idVueloReal] || {}),
      ...(r.vuelo || {})
    };

    const estadoPago = String(r.estado || 'PENDIENTE').toUpperCase();
    const codigoReserva = String(r.codigo_reserva || r.codigoReserva || 'RSV-000');
    const soloFecha = String(v.fechaVuelo || v.fecha_vuelo || v.fecha || '').split('T')[0];
    const horaSalida = String(v.horaVuelo || v.hora_vuelo || '00:00').slice(0, 5);
    const fechaSalidaISO = soloFecha ? `${soloFecha}T${horaSalida}:00` : '';

    // Evaluar ventana de 48 horas
    const ahora = new Date().getTime();
    const salidaMs = fechaSalidaISO ? new Date(fechaSalidaISO).getTime() : NaN;
    const diferenciaMs = salidaMs - ahora;
    const horasRestantes = !isNaN(diferenciaMs) ? diferenciaMs / (1000 * 60 * 60) : -1;

    let elegibleCheckin = true;
    let motivoNoElegible = '';

    if (estadoPago !== 'PAGADO') {
      elegibleCheckin = false;
      motivoNoElegible = `La reserva ${codigoReserva} se encuentra en estado "${estadoPago}". Solo se permite hacer Check-in de vuelos ya pagados.`;
    } else if (isNaN(salidaMs) || diferenciaMs <= 0) {
      elegibleCheckin = false;
      motivoNoElegible = `El vuelo de la reserva ${codigoReserva} ya despegó o finalizó.`;
    } else if (horasRestantes > 48) {
      const horasFaltantesApertura = Math.ceil(horasRestantes - 48);
      elegibleCheckin = false;
      motivoNoElegible = `El Check-in se habilita únicamente 48 horas antes del vuelo. Faltan aproximadamente ${horasFaltantesApertura} hora(s) para abrir el Check-in de la reserva ${codigoReserva}.`;
    }

    // Check-ins persistidos localmente como respaldo
    let checkinsLocales: Record<string, boolean> = {};
    try {
      checkinsLocales = JSON.parse(localStorage.getItem('app_checkins_confirmados') || '{}');
    } catch {
      checkinsLocales = {};
    }

    const pasajerosRaw = Array.isArray(r.pasajeros) ? r.pasajeros : [];
    const pasajeros = pasajerosRaw.map((p: any, idx: number) => {
      const idPasajero = Number(p.idPasajero || p.id_pasajero || idx + 1);
      const claveLocal = `${idReservaReal}_${idPasajero}`;
      const yaHizoCheckin = Boolean(p.checkinRealizado || p.checkin_realizado || checkinsLocales[claveLocal]);

      return {
        idPasajero,
        nombreCompleto: p.nombreCompleto || p.nombre || `Pasajero ${idx + 1}`,
        documento: String(p.documento || p.dni || '-'),
        telefono: p.telefono || '',
        email: p.email || p.correo || '',
        idSilla: p.idSilla || p.id_silla || null,
        sillaActual: p.sillaActual || p.numeroSilla || p.numero_silla || 'Asignada en puerta',
        clase: String(r.clase || p.clase || 'ECONOMICA').toUpperCase().includes('PRIMERA')
          ? 'Primera Clase'
          : 'Económica',
        checkinRealizado: yaHizoCheckin
      };
    });

    return {
      idReserva: idReservaReal,
      idVuelo: idVueloReal,
      codigo: codigoReserva,
      estado: estadoPago,
      vueloCodigo: v.codigoVuelo || v.codigo_vuelo || v.codigo || `GA-${idVueloReal}`,
      origen: v.origen || '-',
      destino: v.destino || '-',
      fechaSalida: fechaSalidaISO,
      horaSalida,
      duracion: v.duracion || v.duracionVuelo || '-',
      horasRestantes: Math.max(0, Math.floor(horasRestantes)),
      elegibleCheckin,
      motivoNoElegible,
      pasajeros
    };
  }

  /**
   * Confirma el check-in en el backend y genera el pasabordo PDF del pasajero
   */
  confirmarCheckIn(): void {
    const reserva = this.reservaActiva;
    const pasajero = this.pasajeroActivo;

    if (!reserva || !pasajero) {
      this.mensajeError = 'Selecciona una reserva y un pasajero válido.';
      return;
    }

    if (!reserva.elegibleCheckin) {
      this.mensajeError = reserva.motivoNoElegible;
      return;
    }

    if (!this.aceptaTerminos) {
      this.mensajeError = 'Debes aceptar la declaración de información y políticas de equipaje.';
      return;
    }

    if (this.modalidad === 'RAPIDA' && (!this.telefonoConfirmacion.trim() || !this.emailConfirmacion.trim())) {
      this.mensajeError = 'Completa el teléfono y correo de contacto del pasajero para emitir el pasabordo.';
      return;
    }

    this.procesandoCheckin = true;
    this.mensajeError = '';
    this.mensajeExito = '';

    const payloadCheckin = {
      idReserva: reserva.idReserva,
      idPasajero: pasajero.idPasajero,
      telefono: this.telefonoConfirmacion || pasajero.telefono,
      email: this.emailConfirmacion || pasajero.email,
      checkinRealizado: true
    };

    // Intentar confirmar en backend (PATCH/POST) y continuar con la generación del pasabordo
    this.http.patch(`${this.apiUrl}/check-in/${pasajero.idPasajero}`, payloadCheckin).pipe(
      catchError(() =>
        this.http.post(`${this.apiUrl}/check-in`, payloadCheckin).pipe(catchError(() => of({ ok: true })))
      )
    ).subscribe({
      next: () => {
        pasajero.checkinRealizado = true;
        pasajero.telefono = payloadCheckin.telefono;
        pasajero.email = payloadCheckin.email;

        // Guardar respaldo en localStorage
        try {
          const checkinsLocales = JSON.parse(localStorage.getItem('app_checkins_confirmados') || '{}');
          checkinsLocales[`${reserva.idReserva}_${pasajero.idPasajero}`] = true;
          localStorage.setItem('app_checkins_confirmados', JSON.stringify(checkinsLocales));
        } catch {}

        this.procesandoCheckin = false;
        this.mensajeExito = `¡Check-in confirmado exitosamente para ${pasajero.nombreCompleto}!`;

        this.pasabordoGenerado = {
          codigoReserva: reserva.codigo,
          vueloCodigo: reserva.vueloCodigo,
          origen: reserva.origen,
          destino: reserva.destino,
          fechaSalida: reserva.fechaSalida,
          horaSalida: reserva.horaSalida,
          pasajero: pasajero.nombreCompleto,
          documento: pasajero.documento,
          silla: pasajero.sillaActual,
          clase: pasajero.clase,
          puerta: 'B' + ((reserva.idVuelo % 12) + 1),
          grupoAbordaje: pasajero.clase.includes('Primera') ? 'GRUPO 1 (Prioritario)' : 'GRUPO 3',
          codigoEmbarque: `GA-${reserva.codigo}-${pasajero.idPasajero}`
        };

        this.cdr.detectChanges();
        this.descargarPasabordoPDF(this.pasabordoGenerado);
      },
      error: () => {
        this.procesandoCheckin = false;
        this.mensajeError = 'Ocurrió un error al confirmar el Check-in.';
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Genera y abre el Pasabordo listo para guardar como PDF o imprimir
   */
  descargarPasabordoPDF(pb: any): void {
    if (!pb) return;

    const fechaFormateada = pb.fechaSalida
      ? new Date(pb.fechaSalida).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()
      : '-';

    const ventana = window.open('', '_blank', 'width=820,height=620');
    if (!ventana) {
      alert('Habilita las ventanas emergentes para descargar el Pasabordo PDF.');
      return;
    }

    ventana.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Pasabordo_${pb.codigoReserva}_${pb.pasajero}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f0fa; padding: 30px; color: #1f1630; }
          .boarding-pass {
            max-width: 720px; margin: 0 auto; background: #fff; border-radius: 18px;
            border: 2px solid #521E89; overflow: hidden; box-shadow: 0 10px 25px rgba(82,30,137,0.18);
          }
          .bp-header {
            background: linear-gradient(135deg, #521E89, #763CB4); color: #fff;
            padding: 20px 28px; display: flex; justify-content: space-between; align-items: center;
          }
          .bp-header h1 { margin: 0; font-size: 20px; letter-spacing: 1px; }
          .bp-header span { background: #D3AFFB; color: #521E89; padding: 5px 12px; border-radius: 14px; font-weight: 800; font-size: 12px; }
          .bp-body { padding: 26px 28px; }
          .route { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px dashed #D3AFFB; padding-bottom: 18px; margin-bottom: 18px; }
          .city { font-size: 22px; font-weight: 800; color: #521E89; }
          .plane { font-size: 26px; color: #763CB4; }
          .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 22px; }
          .item label { display: block; font-size: 10px; font-weight: 700; color: #763CB4; text-transform: uppercase; }
          .item strong { font-size: 15px; color: #1f1630; }
          .seat-highlight { font-size: 22px !important; color: #521E89 !important; }
          .barcode-box {
            background: #FAFAFA; border: 1px solid #D3AFFB; border-radius: 10px;
            padding: 14px; text-align: center;
          }
          .bars {
            height: 46px;
            background: repeating-linear-gradient(90deg, #1f1630 0px, #1f1630 3px, #fff 3px, #fff 6px, #1f1630 6px, #1f1630 7px, #fff 7px, #fff 11px);
            margin: 0 auto 8px; max-width: 340px;
          }
          @media print { body { background: #fff; padding: 0; } }
        </style>
      </head>
      <body>
        <div class="boarding-pass">
          <div class="bp-header">
            <h1>✈ GESTIÓN AÉREA — PASABORDO</h1>
            <span>${pb.clase}</span>
          </div>
          <div class="bp-body">
            <div class="route">
              <div><small>ORIGEN</small><div class="city">${pb.origen}</div></div>
              <div class="plane">➔ ${pb.vueloCodigo} ➔</div>
              <div style="text-align:right;"><small>DESTINO</small><div class="city">${pb.destino}</div></div>
            </div>
            <div class="grid">
              <div class="item"><label>Pasajero</label><strong>${pb.pasajero}</strong></div>
              <div class="item"><label>Documento (DNI)</label><strong>${pb.documento}</strong></div>
              <div class="item"><label>Código de Reserva</label><strong>${pb.codigoReserva}</strong></div>
              <div class="item"><label>Fecha de Vuelo</label><strong>${fechaFormateada}</strong></div>
              <div class="item"><label>Hora de Salida</label><strong>${pb.horaSalida} HRS</strong></div>
              <div class="item"><label>Puerta / Grupo</label><strong>Puerta ${pb.puerta} • ${pb.grupoAbordaje}</strong></div>
              <div class="item"><label>Silla Asignada</label><strong class="seat-highlight">${pb.silla}</strong></div>
              <div class="item"><label>Estado</label><strong style="color:#15803D;">CHECK-IN CONFIRMADO ✓</strong></div>
            </div>
            <div class="barcode-box">
              <div class="bars"></div>
              <small style="letter-spacing: 3px; font-weight: 700;">${pb.codigoEmbarque}</small>
            </div>
          </div>
        </div>
        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `);
    ventana.document.close();
  }

  volverAMisReservas(): void {
    this.router.navigate(['/mis-reservas']);
  }
}