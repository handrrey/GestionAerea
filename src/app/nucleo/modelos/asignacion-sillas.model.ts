export type EstadoSillaBD = 'NO_DISPONIBLE' | 'DISPONIBLE' | 'RESERVADO' | 'ASIGNADO' | 'OCUPADA' | 'BLOQUEADA';
export type ClaseSillaBD = 'PRIMERA' | 'ECONOMICA';

export interface Silla {
  idSilla: number;
  idVuelo: number;
  numeroSilla: string;
  clase: ClaseSillaBD | string;
  estado: EstadoSillaBD | string;
}

export interface AsignarSillaPasajeroDto {
  idReserva: number;
  idPasajero: number;
  idSilla: number;
  numeroSilla: string;
}

export interface RespuestaAsignacionSilla {
  exito: boolean;
  mensaje: string;
  sillaAsignada?: Silla;
}