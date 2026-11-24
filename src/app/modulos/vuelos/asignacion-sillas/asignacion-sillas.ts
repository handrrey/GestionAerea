import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SillaService } from '../../../nucleo/servicios/asignacion-sillas';
import { VuelosService } from '../../../nucleo/servicios/vuelos';
import { Silla } from '../../../nucleo/modelos/asignacion-sillas.model';

interface PasajeroConSilla {
  idPasajero?: number;
  nombreCompleto: string;
  documento: string;
  clase: 'PRIMERA' | 'ECONOMICA';
  sillaActual: string;
  sillaNueva?: string;
  idSillaNueva?: number;
  cambioRealizado: boolean;
}

interface Asiento {
  idSilla?: number;
  codigo: string;
  numeroSilla: number;
  fila: number;
  letra: string;
  esPrimeraClase: boolean;
  estado: 'available' | 'unavailable' | 'reserved' | 'assigned';
  pasajeroAsignado?: string;
}

@Component({
  selector: 'app-asignacion-sillas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './asignacion-sillas.html',
  styleUrls: ['./asignacion-sillas.css']
})
export class AsignacionSillasComponent implements OnInit {
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private sillaService = inject(SillaService);
  private vuelosService = inject(VuelosService);

  idVueloReal: number = 0;
  idReservaReal: number = 0;
  vueloInfo: any = null;
  codigoReserva: string = 'RSV-000';
  pasajeros: PasajeroConSilla[] = [];
  pasajeroSeleccionadoIndex: number = 0;
  esVueloNacional: boolean = true;
  cargandoBackend: boolean = false;

  filas: number[] = [];
  letrasIzquierda: string[] = ['A', 'B', 'C'];
  letrasDerecha: string[] = ['D', 'E', 'F'];

  mapaSillas: Map<string, Asiento> = new Map();
  mensajeNotificacion: string = '';

  ngOnInit(): void {
    let datosContexto = history.state?.vuelo ? history.state : null;

    if (!datosContexto) {
      try {
        const respaldoStr = localStorage.getItem('app_vuelo_para_sillas');
        if (respaldoStr) datosContexto = JSON.parse(respaldoStr);
      } catch (e) {
        console.error('Error al leer contexto:', e);
      }
    }

    const itemRaw = datosContexto?.vuelo || datosContexto || {};
    const vueloInner = itemRaw.vuelo || itemRaw;

    this.idVueloReal = Number(vueloInner.idVuelo || vueloInner.id_vuelo || itemRaw.idVuelo || 101);
    this.idReservaReal = Number(datosContexto?.idReserva || itemRaw.idReserva || itemRaw.id_reserva || 0);
    this.codigoReserva = datosContexto?.codigoReserva || itemRaw.codigoReserva || itemRaw.codigo_reserva || 'RSV-000';

    const codigoVuelo = vueloInner.codigo || vueloInner.codigoVuelo || vueloInner.codigo_vuelo || `AV-${this.idVueloReal}`;
    const origen = vueloInner.origen || vueloInner.ciudadOrigen || vueloInner.ciudad_origen || itemRaw.origen || 'Pereira (PEI)';
    const destino = vueloInner.destino || vueloInner.ciudadDestino || vueloInner.ciudad_destino || itemRaw.destino || 'Nueva York (NYC)';
    const tipoVueloRaw = vueloInner.tipo || vueloInner.tipoVuelo || vueloInner.tipo_vuelo || itemRaw.tipo || '';
    const claseContratada = datosContexto?.clase || itemRaw.clase || vueloInner.clase || 'ECONOMICA';

    this.vueloInfo = {
      codigo: codigoVuelo,
      origen: origen,
      destino: destino,
      tipo: tipoVueloRaw,
      clase: claseContratada
    };

    this.determinarTipoVuelo();

    const listaPasajeros = datosContexto?.pasajeros || itemRaw.pasajeros || vueloInner.pasajeros || [];
    this.cargarPasajeros(listaPasajeros, claseContratada);

    // 1. Generar la estructura base de la cabina
    this.generarMapaCabina();

    // 2. Sincronizar datos reales del vuelo (tipoVuelo / capacidadTotal) y sillas en BD
    if (this.idVueloReal) {
      this.sincronizarInfoVueloYSillasBD();
    }
  }

  private determinarTipoVuelo(): void {
    const origenStr = (this.vueloInfo?.origen || '').toLowerCase();
    const destinoStr = (this.vueloInfo?.destino || '').toLowerCase();
    const tipoStr = (this.vueloInfo?.tipo || '').toLowerCase();
    const ruta = `${origenStr} ${destinoStr}`;

    const palabrasInternacionales = [
      'internacional', 'madrid', '(mad)', 'york', '(nyc)', 'miami', '(mia)',
      'londres', 'london', '(lon)', 'buenos aires', '(bue)', 'panama', 'lima', 'quito'
    ];

    if (palabrasInternacionales.some(p => tipoStr.includes(p) || ruta.includes(p))) {
      this.esVueloNacional = false;
    } else {
      this.esVueloNacional = true;
    }

    const maxFilas = this.esVueloNacional ? 25 : 42;
    this.filas = Array.from({ length: maxFilas }, (_, i) => i + 1);
  }

  private cargarPasajeros(lista: any[], claseGlobalReserva: string): void {
    const claseReservaNormalizada: 'PRIMERA' | 'ECONOMICA' =
      String(claseGlobalReserva).toUpperCase().includes('PRIMERA') ? 'PRIMERA' : 'ECONOMICA';

    // Verificar si ya existen asientos guardados en cache local para esta reserva
    let sillasCache: string[] = [];
    try {
      const mapaAsientos = JSON.parse(localStorage.getItem('app_asientos_por_reserva') || '{}');
      sillasCache = mapaAsientos[this.idReservaReal] || mapaAsientos[this.codigoReserva] || [];
    } catch {}

    const letras = ['A', 'B', 'C', 'D', 'E', 'F'];

    this.pasajeros = (lista || []).map((p, index) => {
      const clasePasajero: 'PRIMERA' | 'ECONOMICA' =
        String(p.clase || claseReservaNormalizada).toUpperCase().includes('PRIMERA') ? 'PRIMERA' : 'ECONOMICA';

      let sillaInicial = sillasCache[index] || p.sillaActual || p.numeroSilla || p.numero_silla || p.silla;
      const filaActual = sillaInicial ? parseInt(String(sillaInicial), 10) : 0;
      const limiteFilaPrimera = this.esVueloNacional ? 4 : 8;

      // Si no tiene silla o la silla por defecto no corresponde a su clase, asignar una válida de su cabina
      if (!sillaInicial || (clasePasajero === 'PRIMERA' && filaActual > limiteFilaPrimera) || (clasePasajero === 'ECONOMICA' && filaActual <= limiteFilaPrimera)) {
        const filaBase = clasePasajero === 'PRIMERA' ? 1 : (this.esVueloNacional ? 6 : 10);
        const fila = filaBase + Math.floor(index / 6);
        const letra = letras[index % 6];
        sillaInicial = `${fila}${letra}`;
      }

      const nombre = (p.nombreCompleto || `${p.nombres || p.nombre || ''} ${p.apellidos || p.apellido || ''}`).trim() || `Pasajero ${index + 1}`;

      return {
        idPasajero: Number(p.idPasajero || p.id_pasajero || p.id || index + 1),
        nombreCompleto: nombre,
        documento: String(p.documento || p.dni || p.cedula || ''),
        clase: clasePasajero,
        sillaActual: String(sillaInicial),
        sillaNueva: undefined,
        cambioRealizado: false
      };
    });

    if (this.pasajeros.length === 0) {
      this.pasajeros = [{
        idPasajero: 1,
        nombreCompleto: 'Pasajero Titular',
        documento: '',
        clase: claseReservaNormalizada,
        sillaActual: claseReservaNormalizada === 'PRIMERA' ? '1A' : (this.esVueloNacional ? '6A' : '10A'),
        sillaNueva: undefined,
        cambioRealizado: false
      }];
    }
  }

  generarMapaCabina(): void {
    this.mapaSillas.clear();

    const pasajeroActual = this.pasajeros[this.pasajeroSeleccionadoIndex];
    const clasePasajeroActual = pasajeroActual?.clase || 'ECONOMICA';

    const totalSillasMax = this.esVueloNacional ? 150 : 250;
    const limitePrimeraClase = this.esVueloNacional ? 25 : 50;

    let contadorSilla = 0;
    const letrasOrdenadas = ['A', 'B', 'C', 'D', 'E', 'F'];
    const sillasReservadasOcupadas = ['2C', '3D', '7F', '12A', '15B', '30C'];

    for (const f of this.filas) {
      for (const l of letrasOrdenadas) {
        contadorSilla++;

        if (contadorSilla > totalSillasMax) continue;

        const codigo = `${f}${l}`;
        const esPrimera = contadorSilla <= limitePrimeraClase;

        let estado: 'available' | 'unavailable' | 'reserved' | 'assigned' = 'available';

        if (clasePasajeroActual === 'PRIMERA' && !esPrimera) {
          estado = 'unavailable';
        } else if (clasePasajeroActual === 'ECONOMICA' && esPrimera) {
          estado = 'unavailable';
        } else if (sillasReservadasOcupadas.includes(codigo)) {
          estado = 'reserved';
        }

        this.mapaSillas.set(codigo, {
          codigo,
          numeroSilla: contadorSilla,
          fila: f,
          letra: l,
          esPrimeraClase: esPrimera,
          estado
        });
      }
    }

    this.pasajeros.forEach(p => {
      const sillaCod = p.sillaNueva || p.sillaActual;
      if (this.mapaSillas.has(sillaCod)) {
        const item = this.mapaSillas.get(sillaCod)!;
        item.estado = 'assigned';
        item.pasajeroAsignado = p.nombreCompleto;
      }
    });

    this.cdr.detectChanges();
  }

  sincronizarInfoVueloYSillasBD(): void {
    this.cargandoBackend = true;

    // 1. Obtener datos exactos del vuelo (tipoVuelo, capacidadTotal, origen, destino)
    this.vuelosService.obtenerVuelos().subscribe({
      next: (listaVuelos: any[]) => {
        const vueloBD = (listaVuelos || []).find(
          (v: any) => Number(v.idVuelo || v.id_vuelo || v.id) === this.idVueloReal
        );

        if (vueloBD) {
          this.vueloInfo = {
            ...this.vueloInfo,
            codigo: vueloBD.codigoVuelo || vueloBD.codigo || this.vueloInfo.codigo,
            origen: vueloBD.origen || this.vueloInfo.origen,
            destino: vueloBD.destino || this.vueloInfo.destino,
            tipo: vueloBD.tipoVuelo || vueloBD.tipo || this.vueloInfo.tipo
          };
          this.determinarTipoVuelo();
          this.generarMapaCabina();
        }
      },
      error: () => {}
    });

    // 2. Consultar sillas en BD
    this.sillaService.obtenerSillasPorVuelo(this.idVueloReal).subscribe({
      next: (sillasBD: Silla[]) => {
        this.cargandoBackend = false;
        if (sillasBD && sillasBD.length > 0) {
          sillasBD.forEach(s => {
            if (this.mapaSillas.has(s.numeroSilla)) {
              const itemMap = this.mapaSillas.get(s.numeroSilla)!;
              itemMap.idSilla = s.idSilla;

              if (s.estado === 'RESERVADO' || s.estado === 'OCUPADA') {
                itemMap.estado = 'reserved';
              } else if (s.estado === 'NO_DISPONIBLE') {
                itemMap.estado = 'unavailable';
              }
            }
          });
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.cargandoBackend = false;
        console.warn('Backend de sillas no disponible aún, usando mapa local.', err);
      }
    });
  }

  seleccionarPasajero(index: number): void {
    this.pasajeroSeleccionadoIndex = index;
    this.mensajeNotificacion = '';
    this.generarMapaCabina();
  }

  existeSilla(fila: number, letra: string): boolean {
    return this.mapaSillas.has(`${fila}${letra}`);
  }

  esEstado(fila: number, letra: string, estadoRequerido: string): boolean {
    const asiento = this.mapaSillas.get(`${fila}${letra}`);
    return asiento ? asiento.estado === estadoRequerido : false;
  }

  esPrimeraClaseFilaLetra(fila: number, letra: string): boolean {
    return this.mapaSillas.get(`${fila}${letra}`)?.esPrimeraClase || false;
  }

  seleccionarSillaPorFilaYLetra(fila: number, letra: string): void {
    const codigo = `${fila}${letra}`;
    const asiento = this.mapaSillas.get(codigo);
    if (!asiento) return;

    const pasajeroActual = this.pasajeros[this.pasajeroSeleccionadoIndex];

    if (asiento.estado === 'unavailable') {
      if (pasajeroActual.clase === 'PRIMERA' && !asiento.esPrimeraClase) {
        this.mensajeNotificacion = '⚠️ Compraste Primera Clase. No puedes seleccionar asientos de Clase Económica.';
      } else if (pasajeroActual.clase === 'ECONOMICA' && asiento.esPrimeraClase) {
        this.mensajeNotificacion = '⚠️ Compraste Clase Económica. No puedes seleccionar asientos de Primera Clase.';
      } else {
        this.mensajeNotificacion = '⚠️ Este asiento no está disponible para selección.';
      }
      this.cdr.detectChanges();
      return;
    }

    if (asiento.estado === 'reserved') {
      this.mensajeNotificacion = '⚠️ Este asiento ya se encuentra reservado por otro pasajero.';
      this.cdr.detectChanges();
      return;
    }

    if (pasajeroActual.cambioRealizado) {
      this.mensajeNotificacion = `⚠️ El pasajero ${pasajeroActual.nombreCompleto} ya consumió su único cambio permitido de silla.`;
      this.cdr.detectChanges();
      return;
    }

    pasajeroActual.sillaNueva = asiento.codigo;
    pasajeroActual.idSillaNueva = asiento.idSilla;
    this.mensajeNotificacion = `🟢 Asiento ${asiento.codigo} seleccionado para ${pasajeroActual.nombreCompleto}.`;
    this.generarMapaCabina();
  }

  confirmarCambioSillas(): void {
    const pasajerosConCambio = this.pasajeros.filter(p => p.sillaNueva && p.sillaNueva !== p.sillaActual);

    if (pasajerosConCambio.length === 0) {
      alert('No has realizado cambios de silla.');
      this.router.navigate(['/mis-reservas']);
      return;
    }

    this.pasajeros.forEach(p => {
      if (p.sillaNueva && p.sillaNueva !== p.sillaActual) {
        p.sillaActual = p.sillaNueva;
        p.sillaNueva = undefined;
        p.cambioRealizado = true;
      }
    });

    try {
      const mapaAsientos = JSON.parse(localStorage.getItem('app_asientos_por_reserva') || '{}');
      const sillasActualizadas = this.pasajeros.map(p => p.sillaActual);
      if (this.idReservaReal) mapaAsientos[this.idReservaReal] = sillasActualizadas;
      if (this.codigoReserva) mapaAsientos[this.codigoReserva] = sillasActualizadas;
      localStorage.setItem('app_asientos_por_reserva', JSON.stringify(mapaAsientos));
    } catch (e) {
      console.error('Error al sincronizar sillas en localStorage:', e);
    }

    const pCambio = pasajerosConCambio[0];
    const dto = {
      idReserva: this.idReservaReal,
      idPasajero: Number(pCambio.idPasajero || 1),
      idSilla: Number(pCambio.idSillaNueva || 0),
      numeroSilla: pCambio.sillaActual
    };

    this.sillaService.asignarSillaAPasajero(dto).subscribe({
      next: () => {
        alert('¡Asignación de sillas guardada en base de datos con éxito!');
        this.router.navigate(['/mis-reservas']);
      },
      error: () => {
        alert('¡Asignación de sillas confirmada localmente!');
        this.router.navigate(['/mis-reservas']);
      }
    });
  }

  cancelar(): void {
    this.router.navigate(['/mis-reservas']);
  }
}