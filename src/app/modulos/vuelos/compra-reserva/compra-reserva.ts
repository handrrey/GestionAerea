import { Component, OnInit, ChangeDetectorRef, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CompraReservaService } from '../../../nucleo/servicios/compra-reserva';
import { CompraReserva, PasajeroForm } from '../../../nucleo/modelos/compra-reserva.model';

export interface ErroresPasajero {
  nombreCompleto?: string;
  documento?: string;
  fechaNacimiento?: string;
  genero?: string;
  telefono?: string;
  email?: string;
  nombreContacto?: string;
  telefonoContacto?: string;
}

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
  errorReglaGrupo: string = '';

  cantidadPasajeros: number = 1;
  claseSeleccionada: 'ECONOMICA' | 'PRIMERA_CLASE' = 'ECONOMICA';
  pasajeros: PasajeroForm[] = [];

  // Mapas de errores y campos tocados por cada pasajero (índice 0..4)
  erroresPorPasajero: ErroresPasajero[] = [];
  camposTocados: Record<string, boolean>[] = [];

  fechaLimitePagoCalculada: Date = new Date();
  fechaMinimaNacimiento: string = '';
  fechaMaximaNacimiento: string = '';

  ngOnInit(): void {
    const navData = this.router.getCurrentNavigation()?.extras?.state?.['vuelo'] || history.state?.vuelo;

    if (navData) {
      const origenStr = navData.origen || navData.ciudadOrigen || navData.ciudad_origen || 'Origen no especificado';
      const destinoStr = navData.destino || navData.ciudadDestino || navData.ciudad_destino || 'Destino no especificado';
      const tipoDetectado = this.determinarTipoVuelo(navData, origenStr, destinoStr);

      this.vuelo = {
        idVuelo: Number(navData.id || navData.idVuelo || navData.id_vuelo || 1),
        codigo: navData.codigo || navData.codigoVuelo || navData.codigo_vuelo || 'AV-800',
        tipo: tipoDetectado,
        origen: origenStr,
        destino: destinoStr,
        duracion: navData.duracionVuelo || navData.duracion || '02h 30m',
        fechaSalida: navData.fecha ? `${navData.fecha}T${navData.horaVuelo || '08:00:00'}` : new Date().toISOString(),
        fechaLlegada: navData.fecha ? `${navData.fecha}T${navData.horaVuelo || '12:00:00'}` : new Date().toISOString(),
        precioBase: Number(navData.precioEconomico || navData.precioBase || navData.costoEconomico || 200)
      };
    }

    this.obtenerSesionUsuario();
    this.actualizarFechaLimite();
    this.configurarLimitesFechasNacimiento();
    this.actualizarCantidadPasajeros();

    this.mostrarCompraReservaPestana = true;
    this.cdr.detectChanges();
  }

  private determinarTipoVuelo(navData: any, origen: string, destino: string): 'NACIONAL' | 'INTERNACIONAL' {
    const tipoExplicito = String(navData?.tipo || navData?.tipoVuelo || navData?.tipo_vuelo || '').toUpperCase().trim();
    if (tipoExplicito.includes('INTERNACIONAL')) return 'INTERNACIONAL';
    if (tipoExplicito.includes('NACIONAL')) return 'NACIONAL';

    const rutaCompleta = `${origen} ${destino}`.toLowerCase();

    const destinosInternacionales = [
      'madrid', '(mad)', 'miami', '(mia)', 'nueva york', 'new york', '(nyc)', '(jfk)',
      'londres', 'london', '(lhr)', 'paris', '(cdg)', 'panama', '(pty)', 'mexico', '(mex)',
      'cancun', '(cun)', 'lima', '(lim)', 'quito', '(uio)', 'santiago', '(scl)',
      'buenos aires', '(eze)', 'sao paulo', '(gru)', 'toronto', '(yyz)', 'los angeles', '(lax)'
    ];

    if (destinosInternacionales.some(palabra => rutaCompleta.includes(palabra))) {
      return 'INTERNACIONAL';
    }

    const ciudadesColombia = [
      'bogota', 'bogotá', '(bog)', 'medellin', 'medellín', '(mde)',
      'cali', '(clo)', 'pereira', '(pei)', 'cartagena', '(ctg)',
      'barranquilla', '(baq)', 'santa marta', '(smr)', 'bucaramanga', '(bga)',
      'san andres', '(adz)', 'armenia', '(axm)', 'manizales', '(mzl)', 'cucuta', '(cuc)'
    ];

    const origenEsColombia = ciudadesColombia.some(c => origen.toLowerCase().includes(c));
    const destinoEsColombia = ciudadesColombia.some(c => destino.toLowerCase().includes(c));

    if (origenEsColombia && destinoEsColombia) {
      return 'NACIONAL';
    }

    return 'INTERNACIONAL';
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
      this.erroresPorPasajero.push({});
      this.camposTocados.push({});
    }

    if (this.pasajeros.length > this.cantidadPasajeros) {
      this.pasajeros = this.pasajeros.slice(0, this.cantidadPasajeros);
      this.erroresPorPasajero = this.erroresPorPasajero.slice(0, this.cantidadPasajeros);
      this.camposTocados = this.camposTocados.slice(0, this.cantidadPasajeros);
    }

    this.revalidarTodosEnTiempoReal(false);
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

  private normalizarTextoComparacion(texto: string): string {
    return String(texto || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  }

  /**
   * Se dispara al escribir o salir de cualquier campo: marca el campo como tocado y actualiza errores al instante
   */
  alCambiarCampo(indice: number, campo: keyof ErroresPasajero, marcarTocado: boolean = true): void {
    if (!this.camposTocados[indice]) this.camposTocados[indice] = {};
    if (marcarTocado) {
      this.camposTocados[indice][campo] = true;
    }

    this.mensajeError = '';
    this.revalidarTodosEnTiempoReal(false);
    this.cdr.detectChanges();
  }

  /**
   * Evalúa todos los campos de todos los pasajeros y actualiza los mensajes de error inmediatos.
   * Si forzarTodosTocados = true (al pulsar Confirmar/Añadir), muestra todos los campos vacíos pendientes.
   */
  private revalidarTodosEnTiempoReal(forzarTodosTocados: boolean): boolean {
    const regexDocumento = /^\d{8,10}$/;
    const regexTelefono = /^\d{10}$/;
    const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const regexSoloLetras = /^[a-zA-ZÀ-ÿ\u00f1\u00d1\s]+$/;

    const documentosRegistrados = new Map<string, number>();
    const nombresRegistrados = new Map<string, number>();

    let formularioValido = true;
    let totalAdultos = 0;
    let totalFechasValidas = 0;

    for (let i = 0; i < this.pasajeros.length; i++) {
      const p = this.pasajeros[i];
      const numPasajero = i + 1;
      const errores: ErroresPasajero = {};

      if (!this.camposTocados[i]) this.camposTocados[i] = {};
      if (forzarTodosTocados) {
        this.camposTocados[i] = {
          nombreCompleto: true,
          documento: true,
          fechaNacimiento: true,
          genero: true,
          telefono: true,
          email: true,
          nombreContacto: true,
          telefonoContacto: true
        };
      }

      const tocado = this.camposTocados[i];

      // 1. Nombres y Apellidos
      const nombreLimpio = String(p.nombreCompleto || '').trim().replace(/\s+/g, ' ');
      if (!nombreLimpio) {
        formularioValido = false;
        if (tocado['nombreCompleto']) {
          errores.nombreCompleto = `El nombre completo del Pasajero ${numPasajero} es obligatorio.`;
        }
      } else if (!regexSoloLetras.test(nombreLimpio)) {
        formularioValido = false;
        errores.nombreCompleto = `Solo se permiten letras y espacios.`;
      } else if (nombreLimpio.split(' ').length < 2) {
        formularioValido = false;
        errores.nombreCompleto = `Ingresa al menos un nombre y un apellido.`;
      } else {
        const nombreNormalizado = this.normalizarTextoComparacion(nombreLimpio);
        if (nombresRegistrados.has(nombreNormalizado)) {
          const pasajeroPrevio = nombresRegistrados.get(nombreNormalizado);
          formularioValido = false;
          errores.nombreCompleto = `Duplicado con el Pasajero ${pasajeroPrevio}. Un mismo pasajero no puede ocupar dos asientos.`;
        } else {
          nombresRegistrados.set(nombreNormalizado, numPasajero);
        }
      }

      // 2. Documento de Identidad
      const docLimpio = String(p.documento || '').trim();
      if (!docLimpio) {
        formularioValido = false;
        if (tocado['documento']) {
          errores.documento = `El documento es obligatorio.`;
        }
      } else if (!regexDocumento.test(docLimpio)) {
        formularioValido = false;
        errores.documento = `Debe tener entre 8 y 10 dígitos numéricos.`;
      } else if (documentosRegistrados.has(docLimpio)) {
        const pasajeroPrevio = documentosRegistrados.get(docLimpio);
        formularioValido = false;
        errores.documento = `La cédula ${docLimpio} ya está registrada en el Pasajero ${pasajeroPrevio}.`;
      } else {
        documentosRegistrados.set(docLimpio, numPasajero);
      }

      // 3. Fecha de Nacimiento y Edad
      if (!p.fechaNacimiento || p.fechaNacimiento.trim() === '') {
        formularioValido = false;
        if (tocado['fechaNacimiento']) {
          errores.fechaNacimiento = `La fecha de nacimiento es obligatoria.`;
        }
      } else {
        const edadCalculada = this.calcularEdad(p.fechaNacimiento);
        if (edadCalculada < 0 || edadCalculada > 100 || isNaN(edadCalculada)) {
          formularioValido = false;
          errores.fechaNacimiento = `Fecha inválida (edad debe estar entre 0 y 100 años).`;
        } else {
          p.edad = edadCalculada;
          totalFechasValidas++;
          if (edadCalculada >= 18) totalAdultos++;
        }
      }

      // 4. Género
      if (!p.genero || p.genero.trim() === '') {
        formularioValido = false;
        if (tocado['genero']) {
          errores.genero = `Selecciona un género.`;
        }
      }

      // 5. Teléfono
      const telLimpio = String(p.telefono || '').trim();
      if (!telLimpio) {
        formularioValido = false;
        if (tocado['telefono']) {
          errores.telefono = `El teléfono es obligatorio.`;
        }
      } else if (!regexTelefono.test(telLimpio)) {
        formularioValido = false;
        errores.telefono = `Debe tener exactamente 10 dígitos.`;
      }

      // 6. Correo Electrónico
      const emailLimpio = String(p.email || '').trim();
      if (!emailLimpio) {
        formularioValido = false;
        if (tocado['email']) {
          errores.email = `El correo electrónico es obligatorio.`;
        }
      } else if (!regexEmail.test(emailLimpio)) {
        formularioValido = false;
        errores.email = `Formato de correo inválido (ej: usuario@dominio.com).`;
      }

      // 7. Nombre Contacto
      const contactoLimpio = String(p.nombreContacto || '').trim();
      if (!contactoLimpio) {
        formularioValido = false;
        if (tocado['nombreContacto']) {
          errores.nombreContacto = `El nombre de contacto es obligatorio.`;
        }
      } else if (!regexSoloLetras.test(contactoLimpio)) {
        formularioValido = false;
        errores.nombreContacto = `Solo se permiten letras y espacios.`;
      }

      // 8. Teléfono Contacto
      const telContactoLimpio = String(p.telefonoContacto || '').trim();
      if (!telContactoLimpio) {
        formularioValido = false;
        if (tocado['telefonoContacto']) {
          errores.telefonoContacto = `El teléfono de contacto es obligatorio.`;
        }
      } else if (!regexTelefono.test(telContactoLimpio)) {
        formularioValido = false;
        errores.telefonoContacto = `Debe tener exactamente 10 dígitos.`;
      }

      this.erroresPorPasajero[i] = errores;
    }

    // Validación en tiempo real de adulto responsable cuando ya ingresaron las fechas
    if (totalFechasValidas === this.pasajeros.length && totalAdultos === 0) {
      formularioValido = false;
      this.errorReglaGrupo = 'Un menor de edad no puede viajar solo. Debe haber al menos un pasajero adulto (mayor de 18 años) en el grupo.';
    } else if (totalFechasValidas > 0 && totalAdultos === 0 && forzarTodosTocados) {
      formularioValido = false;
      this.errorReglaGrupo = 'Un menor de edad no puede viajar solo. Debe haber al menos un pasajero adulto (mayor de 18 años) en el grupo.';
    } else {
      this.errorReglaGrupo = '';
    }

    return formularioValido;
  }

  validarPasajeros(): boolean {
    this.mensajeError = '';
    const esValido = this.revalidarTodosEnTiempoReal(true);

    if (!esValido) {
      this.mensajeError = this.errorReglaGrupo || 'Revisa los campos marcados en rojo antes de continuar.';
    }

    return esValido;
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

    const pasajerosLimpios = this.pasajeros.map(p => ({
      nombreCompleto: p.nombreCompleto.trim(),
      documento: p.documento.trim(),
      fechaNacimiento: p.fechaNacimiento.trim(),
      genero: p.genero.trim(),
      telefono: p.telefono.trim(),
      email: p.email.trim(),
      nombreContacto: p.nombreContacto.trim(),
      telefonoContacto: p.telefonoContacto.trim(),
      edad: Number(p.edad || 18)
    }));

    const idVueloReal = Number(this.vuelo.idVuelo || this.vuelo.id || 1);

    const payload: CompraReserva = {
      codigoReserva: codigoGenerado,
      idUsuario: Number(this.idUsuario),
      idVuelo: idVueloReal,
      montoTotal: Number(this.calcularMontoTotal()),
      cantidadPasajeros: Number(this.cantidadPasajeros),
      clase: this.claseSeleccionada,
      estado: 'Pendiente',
      metodoPago: 'Billetera',
      fechaReserva: new Date().toISOString(),
      fechaLimitePago: this.fechaLimitePagoCalculada.toISOString(),
      pasajeros: pasajerosLimpios as any
    };

    try {
      const mapaVuelos = JSON.parse(localStorage.getItem('app_mapa_vuelos_reservados') || '{}');
      mapaVuelos[idVueloReal] = {
        codigo: this.vuelo.codigo || 'AV-800',
        origen: this.vuelo.origen,
        destino: this.vuelo.destino,
        duracion: this.vuelo.duracion || '02h 30m',
        fechaSalida: this.vuelo.fechaSalida,
        fechaLlegada: this.vuelo.fechaLlegada
      };
      localStorage.setItem('app_mapa_vuelos_reservados', JSON.stringify(mapaVuelos));
    } catch (e) {
      console.error('Error al guardar caché local del vuelo:', e);
    }

    this.compraReservaService.crearReserva(payload).subscribe({
      next: () => {
        this.mensajeExito = `¡Reserva confirmada con éxito! Código: ${codigoGenerado}.`;
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