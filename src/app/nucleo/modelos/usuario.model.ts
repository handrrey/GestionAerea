export type RolUsuario = 'ROOT' | 'ADMIN' | 'CLIENTE' | 'VISITANTE';

export interface Usuario {
  id_usuario?: number;
  cc?: number;
  nombres?: string;
  apellidos?: string;
  fechaNacimiento?: string;
  lugarNacimiento?: string;
  direccionFacturacion?: string;
  genero?: string;
  correo?: string;
  usuario?: string;
  password?: string;
  imagenUrl?: string;
  suscritoNoticias?: boolean;
  rol: RolUsuario;
  informacionPerfil?: {
    dni?: number;
    nombres: string;
    apellidos: string;
  };
}