import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router'; // Inyectamos Router por si necesitas cambiar de página
import { VuelosService } from '../../../nucleo/servicios/vuelos'; // Importamos el servicio
import { Vuelo } from '../../../nucleo/modelos/vuelos.model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './home.html',
  styleUrls: ['./home.css']
})
export class HomeComponent implements OnInit {

  ciudades: string[] = [
    'Pereira (PEI)', 'Bogotá (BOG)', 'Medellín (MDE)', 'Cartagena (CTG)',
    'Cali (CLO)', 'Miami (MIA)', 'Madrid (MAD)', 'Buenos Aires (BUE)',
    'Londres (LON)', 'New York (NYC)'
  ];

  tipoViaje: 'SOLO_IDA' | 'IDA_Y_VUELTA' = 'SOLO_IDA';
  origenSeleccionado: string = '';
  destinoSeleccionado: string = '';
  fechaIda: string = '';
  fechaVuelta: string = '';
  pasajeros: number = 1;
  rangoPrecio: string = 'Cualquiera';

  mensajeError: string = '';
  
  // Nueva variable para guardar los resultados del backend
  vuelosEncontrados: Vuelo[] = [];

  // Inyectamos el servicio de vuelos y el router
  constructor(
    private vuelosService: VuelosService,
    private router: Router
  ) {}

  ngOnInit(): void {}

  get destinosDisponibles(): string[] {
    if (!this.origenSeleccionado) {
      return this.ciudades;
    }
    return this.ciudades.filter(c => c !== this.origenSeleccionado);
  }

  onOrigenChange(): void {
    if (this.destinoSeleccionado === this.origenSeleccionado) {
      this.destinoSeleccionado = '';
    }
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
    this.vuelosEncontrados = []; // Limpiamos búsquedas anteriores

    // --- TUS VALIDACIONES INTACTAS ---
    if (!this.origenSeleccionado || !this.destinoSeleccionado) {
      this.mensajeError = 'Selecciona la ciudad de origen y destino.';
      return;
    }
    if (!this.fechaIda) {
      this.mensajeError = 'Selecciona la fecha de ida.';
      return;
    }

    const fechaSalidaMs = new Date(this.fechaIda).getTime();
    const hoyMs = new Date(this.minFecha).getTime();
    const unAnoMs = new Date(this.maxFecha).getTime();

    if (fechaSalidaMs < hoyMs) {
      this.mensajeError = 'No puedes seleccionar una fecha de ida anterior a hoy.';
      return;
    }
    if (fechaSalidaMs > unAnoMs) {
      this.mensajeError = 'No se pueden buscar vuelos con más de un año de anticipación.';
      return;
    }

    if (this.tipoViaje === 'IDA_Y_VUELTA') {
      if (!this.fechaVuelta) {
        this.mensajeError = 'Selecciona la fecha de regreso.';
        return;
      }
      const fechaRegresoMs = new Date(this.fechaVuelta).getTime();
      if (fechaRegresoMs < fechaSalidaMs) {
        this.mensajeError = 'La fecha de regreso no puede ser anterior a la fecha de salida.';
        return;
      }
      if (fechaRegresoMs > unAnoMs) {
        this.mensajeError = 'La fecha de regreso no puede superar el año de anticipación.';
        return;
      }
    }
    // --- FIN DE VALIDACIONES ---

    // Petición al backend
    this.vuelosService.buscarVuelosPorRuta(this.origenSeleccionado, this.destinoSeleccionado, this.fechaIda).subscribe({
      next: (resultados) => {
        this.vuelosEncontrados = resultados;
        
        if (this.vuelosEncontrados.length === 0) {
          this.mensajeError = 'No se encontraron vuelos para esta ruta y fecha.';
        }
        
        // NOTA: Si prefieres llevar al usuario a otra pantalla con los resultados en lugar de mostrarlos en el Home,
        // puedes usar: this.router.navigate(['/resultados'], { queryParams: { origen: this.origenSeleccionado, destino: this.destinoSeleccionado } });
      },
      error: (err) => {
        console.error('Error al buscar vuelos:', err);
        this.mensajeError = 'Hubo un problema de conexión al buscar los vuelos.';
      }
    });
  }
}