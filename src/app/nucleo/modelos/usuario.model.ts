export type RolUsuario = 'ROOT' | 'ADMINISTRADOR' | 'CLIENTE' | 'VISITANTE';

export interface Usuario {
  id?: number;
  cc: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento?: string;
  lugarNacimiento?: string;
  direccionFacturacion?: string;
  genero?: string;
  email: string;
  username: string;
  password?: string;
  imagenUrl?: string;
  rol: RolUsuario;
  suscritoNoticias?: boolean;
}