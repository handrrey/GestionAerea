export interface Vuelo {
  id: number;
  codigo: string;
  origen: string;
  destino: string;
  fechaHora: string;
  precio: number;
  estado: 'PROGRAMADO' | 'REALIZADO' | 'CANCELADO';
  reservasCount?: number; 
}