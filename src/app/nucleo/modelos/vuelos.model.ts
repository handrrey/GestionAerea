export interface Vuelo {
  id: number;
  codigo: string;
  origen: string;
  destino: string;
  fecha: Date;
  horaVuelo: string;
  duracionVuelo: string;
  precioEconomico: number;
  precioPrimera: number;
  estado: 'Programado' | 'Realizado' | 'Cancelado';
  reservasCount?: number; 
  idAdmin?: number;
}