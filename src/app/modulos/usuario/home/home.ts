import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './home.html',
  styleUrls: ['./home.css']
})
export class HomeComponent implements OnInit {

  ciudadesOrigen: string[] = [
    'Pereira (PEI)', 'Bogotá (BOG)', 'Medellín (MDE)', 'Cali (CLO)', 'Cartagena (CTG)'
  ];

  ciudadesDestino: string[] = [
    'Pereira (PEI)', 'Bogotá (BOG)', 'Medellín (MDE)', 'Cartagena (CTG)',
    'Cali (CLO)', 'Miami (MIA)', 'Madrid (MAD)', 'Buenos Aires (BUE)',
    'Londres (LON)', 'Nueva York (NYC)'
  ];

  tipoViaje: 'SOLO_IDA' | 'IDA_Y_VUELTA' = 'SOLO_IDA';
  origenSeleccionado: string = '';
  destinoSeleccionado: string = '';
  fechaIda: string = '';
  fechaVuelta: string = '';
  rangoPrecio: string = 'Cualquiera';

  mensajeError: string = '';

  constructor(
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {}

  get destinosDisponibles(): string[] {
    if (!this.origenSeleccionado) {
      return this.ciudadesDestino;
    }
    return this.ciudadesDestino.filter(c => c !== this.origenSeleccionado);
  }

  onOrigenChange(): void {
    if (this.destinoSeleccionado === this.origenSeleccionado) {
      this.destinoSeleccionado = '';
    }
  }

  limpiarFecha(): void {
    this.fechaIda = '';
    this.fechaVuelta = '';
  }

  get minFecha(): string {
    const hoy = new Date();
    return this.formatearFechaIso(hoy);
  }

  get maxFecha(): string {
    const unAnoDespues = new Date();
    unAnoDespues.setFullYear(unAnoDespues.getFullYear() + 1);
    return this.formatearFechaIso(unAnoDespues);
  }

  private formatearFechaIso(date: Date): string {
    const anio = date.getFullYear();
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const dia = String(date.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }

  seleccionarTipoViaje(tipo: 'SOLO_IDA' | 'IDA_Y_VUELTA'): void {
    this.tipoViaje = tipo;
    if (this.tipoViaje === 'SOLO_IDA') {
      this.fechaVuelta = '';
    }
  }

  buscarVuelos(): void {
    this.mensajeError = '';

    // Validaciones básicas de selección
    if (!this.origenSeleccionado || !this.destinoSeleccionado) {
      this.mensajeError = 'Selecciona la ciudad de origen y destino.';
      this.cdr.detectChanges();
      return;
    }

    if (this.fechaIda) {
      const fechaSalidaMs = new Date(this.fechaIda).getTime();
      const hoyMs = new Date(this.minFecha).getTime();
      const unAnoMs = new Date(this.maxFecha).getTime();

      if (fechaSalidaMs < hoyMs) {
        this.mensajeError = 'No puedes seleccionar una fecha de ida anterior a hoy.';
        this.cdr.detectChanges();
        return;
      }
      if (fechaSalidaMs > unAnoMs) {
        this.mensajeError = 'No se pueden buscar vuelos con más de un año de anticipación.';
        this.cdr.detectChanges();
        return;
      }
    }

    // Navegación explícita redirigiendo a la ruta con queryParams
    this.router.navigate(['/buscar-vuelos-parametrizados'], {
      queryParams: {
        origen: this.origenSeleccionado,
        destino: this.destinoSeleccionado,
        fecha: this.fechaIda || null,
        precioMaximo: this.rangoPrecio !== 'Cualquiera' ? this.rangoPrecio : null,
        tipoViaje: this.tipoViaje
      }
    });
  }
}