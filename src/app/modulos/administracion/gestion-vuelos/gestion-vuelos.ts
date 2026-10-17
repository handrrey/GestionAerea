import { Component, OnInit } from '@angular/core';
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
  
  ciudades: string[] = [
    'Pereira (PEI)', 'Bogotá (BOG)', 'Medellín (MDE)', 'Cartagena (CTG)',
    'Cali (CLO)', 'Miami (MIA)', 'Madrid (MAD)', 'Londres (LON)',
    'Nueva York (NYC)', 'Buenos Aires (BUE)',
  ];

  mostrarModal: boolean = false;
  editando: boolean = false;
  vueloForm: Vuelo = this.obtenerVueloVacio();

  promocionesActivasCount: number = 3;
  mensajesSinResponderCount: number = 5;

  constructor(
    private authService: AutenticacionService,
    private vuelosService: VuelosService // <--- INYECCIÓN NUEVA
  ) {}

  ngOnInit(): void {
    this.usuarioActual = this.authService.obtenerUsuarioActual();
    this.cargarVuelos(); // Llama al backend
  }

  // 1. CARGAR DESDE EL BACKEND (Reemplaza el uso de localStorage)
  cargarVuelos(): void {
    this.vuelosService.obtenerVuelos().subscribe({
      next: (datosBackend) => {
        this.vuelos = datosBackend;
      },
      error: (err) => {
        console.error('Error al cargar vuelos:', err);
        alert('No se pudieron cargar los vuelos desde el servidor.');
      }
    });
  }

  obtenerVueloVacio(): Vuelo {
    return { id: 0, codigo: '', origen: '', destino: '', fechaHora: '', precio: 0, estado: 'PROGRAMADO', reservasCount: 0 };
  }

  get destinosDisponibles(): string[] {
    if (!this.vueloForm.origen) return this.ciudades;
    return this.ciudades.filter(c => c !== this.vueloForm.origen);
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
    return this.vuelos.filter(v => v.estado === 'PROGRAMADO').length;
  }

  get vuelosRealizadosCount(): number {
    return this.vuelos.filter(v => v.estado === 'REALIZADO').length;
  }

  abrirModalNuevo(): void {
    this.editando = false;
    this.vueloForm = this.obtenerVueloVacio();
    this.mostrarModal = true;
  }

  abrirModalEditar(vuelo: Vuelo): void {
    if (vuelo.estado === 'REALIZADO') return;
    this.editando = true;
    this.vueloForm = { ...vuelo };
    this.mostrarModal = true;
  }

  cerrarModal(): void {
    this.mostrarModal = false;
    this.vueloForm = this.obtenerVueloVacio();
  }

  get minFechaHora(): string {
    const ahora = new Date();
    return this.formatearParaInputDateTime(ahora);
  }

  get maxFechaHora(): string {
    const unAnoDespues = new Date();
    unAnoDespues.setFullYear(unAnoDespues.getFullYear() + 1);
    return this.formatearParaInputDateTime(unAnoDespues);
  }

  private formatearParaInputDateTime(date: Date): string {
    const anio = date.getFullYear();
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const dia = String(date.getDate()).padStart(2, '0');
    const horas = String(date.getHours()).padStart(2, '0');
    const minutos = String(date.getMinutes()).padStart(2, '0');
    return `${anio}-${mes}-${dia}T${horas}:${minutos}`;
  }

  // 2. GUARDAR / EDITAR EN EL BACKEND
  guardarVuelo(): void {
    if (!this.vueloForm.codigo || !this.vueloForm.origen || !this.vueloForm.destino || !this.vueloForm.fechaHora || this.vueloForm.precio <= 0) {
      alert('Por favor completa todos los campos correctamente.');
      return;
    }

    const fechaVuelo = new Date(this.vueloForm.fechaHora).getTime();
    const ahora = new Date().getTime();
    const unAnoDespues = new Date();
    unAnoDespues.setFullYear(unAnoDespues.getFullYear() + 1);
    const limiteAno = unAnoDespues.getTime();

    if (fechaVuelo < ahora) {
      alert('No es posible programar vuelos con fechas o horas pasadas.');
      return;
    }
    if (fechaVuelo > limiteAno) {
      alert('Las aerolíneas no pueden programar vuelos con más de un año de anticipación.');
      return;
    }

    if (this.editando) {
      // Petición HTTP PUT (Editar)
      this.vuelosService.editarVuelo(this.vueloForm.id, this.vueloForm).subscribe({
        next: () => {
          this.cargarVuelos();
          this.cerrarModal();
        },
        error: () => alert('Error al editar el vuelo en el servidor.')
      });
    } else {
      // Petición HTTP POST (Crear)
      this.vuelosService.crearVuelo(this.vueloForm).subscribe({
        next: () => {
          this.cargarVuelos();
          this.cerrarModal();
        },
        error: () => alert('Error al crear el vuelo en el servidor.')
      });
    }
  }

  // 3. CANCELAR EN EL BACKEND
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

  formatearFechaHora(fechaIso: string): string {
    if (!fechaIso) return '';
    const date = new Date(fechaIso);
    const dia = String(date.getDate()).padStart(2, '0');
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const anio = date.getFullYear();
    const horas = String(date.getHours()).padStart(2, '0');
    const minutos = String(date.getMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${anio} ${horas}:${minutos}`;
  }
}