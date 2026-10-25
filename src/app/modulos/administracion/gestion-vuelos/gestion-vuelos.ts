import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AutenticacionService } from '../../../nucleo/servicios/autenticacion';
import { VuelosService } from '../../../nucleo/servicios/vuelos';
import { Usuario } from '../../../nucleo/modelos/usuario.model';
import { Vuelo } from '../../../nucleo/modelos/vuelos.model';

@Component({
  selector: 'app-gestion-vuelos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './gestion-vuelos.html',
  styleUrls: ['./gestion-vuelos.css']
})
export class GestionVuelosComponent implements OnInit {

  usuarioActual: Usuario | null = null;
  vuelos: Vuelo[] = [];
  
  // Orígenes restringidos únicamente a estas 5 ciudades
  ciudadesOrigen: string[] = [
    'Pereira (PEI)', 'Bogotá (BOG)', 'Medellín (MDE)', 'Cali (CLO)', 'Cartagena (CTG)'
  ];

  // Destinos completos disponibles
  ciudadesDestino: string[] = [
    'Pereira (PEI)', 'Bogotá (BOG)', 'Medellín (MDE)', 'Cartagena (CTG)',
    'Cali (CLO)', 'Miami (MIA)', 'Madrid (MAD)', 'Londres (LON)',
    'Nueva York (NYC)', 'Buenos Aires (BUE)'
  ];

  mostrarModal: boolean = false;
  editando: boolean = false;
  vueloForm: Vuelo = this.obtenerVueloVacio();

  promocionesActivasCount: number = 3;
  mensajesSinResponderCount: number = 5;

  constructor(
    private authService: AutenticacionService,
    private vuelosService: VuelosService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.usuarioActual = this.authService.obtenerUsuarioActual();
    this.cargarVuelos(); 
  }

  cargarVuelos(): void {
    this.vuelosService.obtenerVuelos().subscribe({
      next: (datosBackend) => {
        this.vuelos = datosBackend;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar vuelos:', err);
        alert('No se pudieron cargar los vuelos desde el servidor.');
      }
    });
  }

  obtenerVueloVacio(): Vuelo {
    return { 
      id: 0, 
      codigo: '', 
      origen: '', 
      destino: '', 
      fecha: new Date(), 
      horaVuelo: '', 
      horaLlegada: '', 
      precioEconomico: 0, 
      precioPrimera: 0, 
      estado: 'Programado', 
      reservasCount: 0 
    };
  }

  // cualquiera menos el seleccionado como origen
  get destinosDisponibles(): string[] {
    if (!this.vueloForm.origen) return this.ciudadesDestino;
    return this.ciudadesDestino.filter(c => c !== this.vueloForm.origen);
  }

  onOrigenChange(): void {
    if (this.vueloForm.destino === this.vueloForm.origen) {
      this.vueloForm.destino = '';
    }
  }

  get esOrigenDestinoDeshabilitado(): boolean {
    return this.editando;
  }

  get esFechaHoraDeshabilitada(): boolean {
    if (!this.editando) return false;
    return (this.vueloForm.reservasCount ?? 0) > 0;
  }

  get vuelosProgramadosCount(): number {
    return this.vuelos.filter(v => v.estado === 'Programado').length;
  }

  get vuelosRealizadosCount(): number {
    return this.vuelos.filter(v => v.estado === 'Realizado').length;
  }

  abrirModalNuevo(): void {
    this.editando = false;
    this.vueloForm = this.obtenerVueloVacio();
    this.mostrarModal = true;
  }

  abrirModalEditar(vuelo: Vuelo): void {
    if (vuelo.estado === 'Realizado') return;
    this.editando = true;
    this.vueloForm = { ...vuelo };
    this.mostrarModal = true;
  }

  cerrarModal(): void {
    this.mostrarModal = false;
    this.vueloForm = this.obtenerVueloVacio();
  }

  get minFecha(): string {
    const ahora = new Date();
    return ahora.toISOString().split('T')[0];
  }

  get maxFecha(): string {
    const unAnoDespues = new Date();
    unAnoDespues.setFullYear(unAnoDespues.getFullYear() + 1);
    return unAnoDespues.toISOString().split('T')[0];
  }

  guardarVuelo(): void {
    if (
      !this.vueloForm.codigo || 
      !this.vueloForm.origen || 
      !this.vueloForm.destino || 
      !this.vueloForm.fecha || 
      !this.vueloForm.horaVuelo || 
      !this.vueloForm.horaLlegada || 
      this.vueloForm.precioEconomico <= 0 || 
      this.vueloForm.precioPrimera <= 0
    ) {
      alert('Por favor completa todos los campos correctamente, incluyendo ambos precios.');
      return;
    }

    const fechaVueloStr = typeof this.vueloForm.fecha === 'string' 
      ? this.vueloForm.fecha 
      : new Date(this.vueloForm.fecha).toISOString().split('T')[0];
      
    const fechaVueloTime = new Date(`${fechaVueloStr}T${this.vueloForm.horaVuelo}`).getTime();
    const ahora = new Date().getTime();
    
    const unAnoDespues = new Date();
    unAnoDespues.setFullYear(unAnoDespues.getFullYear() + 1);
    const limiteAno = unAnoDespues.getTime();

    if (fechaVueloTime < ahora) {
      alert('No es posible programar vuelos con fechas o horas pasadas.');
      return;
    }
    if (fechaVueloTime > limiteAno) {
      alert('Las aerolíneas no pueden programar vuelos con más de un año de anticipación.');
      return;
    }

    if (this.editando) {
      this.vuelosService.editarVuelo(this.vueloForm.id, this.vueloForm).subscribe({
        next: () => {
          this.cargarVuelos();
          this.cerrarModal();
        },
        error: () => alert('Error al editar el vuelo en el servidor.')
      });
    } else {
      this.vuelosService.crearVuelo(this.vueloForm).subscribe({
        next: () => {
          this.cargarVuelos();
          this.cerrarModal();
        },
        error: () => alert('Error al crear el vuelo en el servidor.')
      });
    }
  }

  cancelarVuelo(id: number): void {
    if (confirm('¿Estás seguro de que deseas cancelar este vuelo?')) {
      this.vuelosService.cancelarVuelo(id).subscribe({
        next: () => {
          this.cargarVuelos();
        },
        error: () => alert('Error al cancelar el vuelo en el servidor.')
      });
    }
  }

  cerrarSesion(): void {
    this.authService.cerrarSesion();
    window.location.href = '/inicio-sesion';
  }

  formatearFecha(fecha: Date | string): string {
    if (!fecha) return '';
    const date = new Date(fecha);
    const dia = String(date.getDate()).padStart(2, '0');
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const anio = date.getFullYear();
    return `${dia}/${mes}/${anio}`;
  }
}