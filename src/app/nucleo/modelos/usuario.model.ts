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
  email?: string;
  usuario?: string;
  password?: string;
  imagenUrl?: string;
  rol: RolUsuario;
}

export interface UsuarioCreadoResponse {
  message: string;
  usuario: Usuario;
}
