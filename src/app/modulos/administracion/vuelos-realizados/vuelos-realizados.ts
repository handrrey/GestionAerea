import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AutenticacionService } from '../../../nucleo/servicios/autenticacion';
import { VuelosService } from '../../../nucleo/servicios/vuelos';
import { Usuario } from '../../../nucleo/modelos/usuario.model';

@Component({
  selector: 'app-vuelos-realizados',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './vuelos-realizados.html',
  styleUrls: ['./vuelos-realizados.css']
})
export class VuelosRealizadosComponent implements OnInit {

  usuarioActual: Usuario | null = null;
  vuelosRealizados: any[] = [];
  cargando: boolean = true;
  filtroBusqueda: string = '';
  filtroTipo: 'TODOS' | 'NACIONAL' | 'INTERNACIONAL' = 'TODOS';

  private apiUrl = 'http://localhost:3000/appV1';

  constructor(
    private authService: AutenticacionService,
    private vuelosService: VuelosService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.usuarioActual = this.authService.obtenerUsuarioActual();
    this.cargarHistorialVuelos();
  }

  cargarHistorialVuelos(): void {
    this.cargando = true;

    const reservas$ = this.http.get<any>(`${this.apiUrl}/compra-reserva`).pipe(
      catchError(() => this.http.get<any>(`${this.apiUrl}/reservas`).pipe(catchError(() => of([]))))
    );

    forkJoin({
      vuelos: this.vuelosService.obtenerVuelos(),
      reservasRes: reservas$
    }).subscribe({
      next: ({ vuelos, reservasRes }) => {
        const listaReservas = Array.isArray(reservasRes)
          ? reservasRes
          : (reservasRes?.reservas || reservasRes?.data || []);

        const conteoPorVuelo: Record<number, { pasajeros: number; recaudo: number }> = {};

        for (const r of listaReservas) {
          const estadoRes = String(r.estado || '').toUpperCase();
          if (estadoRes === 'CANCELADO' || estadoRes === 'EXPIRADO') continue;

          const idVueloRes = Number(r.id_vuelo || r.idVuelo || r.vuelo?.id_vuelo || r.vuelo?.idVuelo || 0);
          if (idVueloRes > 0) {
            if (!conteoPorVuelo[idVueloRes]) {
              conteoPorVuelo[idVueloRes] = { pasajeros: 0, recaudo: 0 };
            }
            const cant = Number(r.cantidad_pasajeros || r.cantidadPasajeros || r.pasajeros?.length || 1);
            conteoPorVuelo[idVueloRes].pasajeros += cant;
            if (estadoRes === 'PAGADO') {
              conteoPorVuelo[idVueloRes].recaudo += Number(r.monto_total || r.montoTotal || 0);
            }
          }
        }

        const ahora = new Date().getTime();

        this.vuelosRealizados = (vuelos || [])
          .map((v: any) => {
            const idVueloReal = Number(v.idVuelo || v.id_vuelo || v.id || 0);
            const estadoRaw = String(v.estado || v.estado_vuelo || 'Programado');
            const fechaStr = String(v.fechaVuelo || v.fecha_vuelo || v.fecha || '').split('T')[0];
            const horaStr = String(v.horaVuelo || v.hora_vuelo || '00:00');
            const fechaHoraSalida = fechaStr ? new Date(`${fechaStr}T${horaStr.slice(0, 5)}:00`).getTime() : NaN;

            // Se considera realizado si su estado es 'Realizado' o si su fecha/hora ya finalizó
            const yaFinalizo =
              estadoRaw.toLowerCase() === 'realizado' ||
              (estadoRaw.toLowerCase() === 'programado' && !isNaN(fechaHoraSalida) && fechaHoraSalida < ahora);

            const tipoRaw = String(v.tipoVuelo || v.tipo_vuelo || v.tipo || '').toUpperCase();
            const tipoNormalizado = tipoRaw.includes('INTER') ? 'INTERNACIONAL' : 'NACIONAL';
            const capacidad = Number(v.capacidadTotal || v.capacidad_total || (tipoNormalizado === 'INTERNACIONAL' ? 250 : 150));

            const stats = conteoPorVuelo[idVueloReal] || { pasajeros: 0, recaudo: 0 };
            const totalReservas = Math.max(
              stats.pasajeros,
              Number(v.reservasTotal ?? v.reservasCount ?? v.reservas_total ?? 0)
            );

            return {
              id: idVueloReal,
              codigo: v.codigoVuelo || v.codigo_vuelo || v.codigo || '-',
              tipo: tipoNormalizado,
              origen: v.origen || '-',
              destino: v.destino || '-',
              fecha: fechaStr,
              horaVuelo: horaStr,
              horaLlegada: v.horaLlegada || v.hora_llegada || '-',
              duracion: v.duracion || v.duracionVuelo || '-',
              precioEconomico: Number(v.costoEconomico ?? v.precioEconomico ?? 0),
              precioPrimera: Number(v.costoPrimera ?? v.precioPrimera ?? 0),
              capacidadTotal: capacidad,
              pasajerosTransportados: totalReservas,
              recaudoTotal: stats.recaudo,
              estado: 'Realizado',
              yaFinalizo
            };
          })
          .filter((v: any) => v.yaFinalizo)
          .sort((a: any, b: any) => b.fecha.localeCompare(a.fecha));

        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar vuelos realizados:', err);
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  get vuelosFiltrados(): any[] {
    const termino = this.filtroBusqueda.trim().toLowerCase();

    return this.vuelosRealizados.filter(v => {
      const cumpleTipo = this.filtroTipo === 'TODOS' || v.tipo === this.filtroTipo;
      if (!cumpleTipo) return false;

      if (!termino) return true;
      return (
        v.codigo.toLowerCase().includes(termino) ||
        v.origen.toLowerCase().includes(termino) ||
        v.destino.toLowerCase().includes(termino)
      );
    });
  }

  get totalVuelosCompletados(): number {
    return this.vuelosRealizados.length;
  }

  get totalPasajerosHistorico(): number {
    return this.vuelosRealizados.reduce((acc, v) => acc + (v.pasajerosTransportados || 0), 0);
  }

  get totalRecaudoHistorico(): number {
    return this.vuelosRealizados.reduce((acc, v) => acc + (v.recaudoTotal || 0), 0);
  }

  get porcentajeOcupacionPromedio(): number {
    if (this.vuelosRealizados.length === 0) return 0;
    const sumaPorcentajes = this.vuelosRealizados.reduce((acc, v) => {
      const cap = v.capacidadTotal || 150;
      return acc + Math.min(100, Math.round((v.pasajerosTransportados / cap) * 100));
    }, 0);
    return Math.round(sumaPorcentajes / this.vuelosRealizados.length);
  }

  formatearFecha(fechaStr: string): string {
    if (!fechaStr) return '-';
    const partes = fechaStr.split('-');
    if (partes.length !== 3) return fechaStr;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }

  cerrarSesion(): void {
    this.authService.cerrarSesion();
    window.location.href = '/inicio-sesion';
  }
}