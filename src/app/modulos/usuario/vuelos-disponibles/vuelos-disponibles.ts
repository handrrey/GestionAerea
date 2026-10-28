import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { VuelosService } from '../../../nucleo/servicios/vuelos';
import { Vuelo } from '../../../nucleo/modelos/vuelos.model';

@Component({
  selector: 'app-vuelos-disponibles',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './vuelos-disponibles.html',
  styleUrls: ['./vuelos-disponibles.css']
})
export class VuelosDisponiblesComponent implements OnInit {

  vuelosProgramados: Vuelo[] = [];
  cargando: boolean = true;
  mensajeError: string = '';

  constructor(
    private vuelosService: VuelosService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarTodosLosVuelos();
  }

  cargarTodosLosVuelos(): void {
    this.cargando = true;
    this.vuelosService.obtenerVuelos().subscribe({
      next: (datosBackend: any[]) => {
        const resultadosMapeados: Vuelo[] = (datosBackend || []).map(v => {
          let rawFecha = v.fecha || v.fechaVuelo || v.fecha_vuelo || '';
          let fechaStr = '';

          if (typeof rawFecha === 'string') {
            fechaStr = rawFecha.split('T')[0];
          } else if (rawFecha instanceof Date) {
            const d = new Date(rawFecha);
            const a = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dia = String(d.getDate()).padStart(2, '0');
            fechaStr = `${a}-${m}-${dia}`;
          }

          return {
            ...v,
            id: v.id || v.idVuelo || v.id_vuelo || 0,
            codigo: v.codigo || v.codigoVuelo || v.codigo_vuelo || 'GA-000',
            origen: v.origen || v.origen_vuelo || '',
            destino: v.destino || v.destino_vuelo || '',
            fecha: fechaStr,
            horaVuelo: v.horaVuelo || v.hora_vuelo || '',
            duracionVuelo: v.duracionVuelo || v.duracion || v.duracion_vuelo || '',
            precioEconomico: Number(v.precioEconomico ?? v.costoEconomico ?? v.costo_economico ?? 0),
            precioPrimera: Number(v.precioPrimera ?? v.costoPrimera ?? v.costo_primera ?? 0),
            estado: v.estado || v.estado_vuelo || 'Programado'
          };
        });

        this.vuelosProgramados = resultadosMapeados.filter(v => 
          (v.estado || '').toLowerCase() === 'programado'
        );

        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar la lista general de vuelos:', err);
        this.vuelosProgramados = [];
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  // 🟢 Redirección a Compra/Reserva
  seleccionarVuelo(vuelo: Vuelo): void {
    this.mensajeError = '';

    const sesionStr = localStorage.getItem('app_usuario_actual');
    if (!sesionStr) {
      this.mensajeError = 'Debe ser cliente registrado para hacer reservas o compras.';
      this.cdr.detectChanges();
      return;
    }

    try {
      const usuario = JSON.parse(sesionStr);
      const rol = String(usuario.rol || 'VISITANTE').toUpperCase();

      if (rol === 'VISITANTE') {
        this.mensajeError = 'Debe ser cliente registrado para hacer reservas o compras.';
        this.cdr.detectChanges();
        return;
      }

      this.router.navigate(['/compra-reserva'], {
        state: { vuelo }
      });

    } catch (e) {
      this.mensajeError = 'Debe ser cliente registrado para hacer reservas o compras.';
      this.cdr.detectChanges();
    }
  }
}