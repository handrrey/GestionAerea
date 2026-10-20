import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Usuario } from '../modelos/usuario.model';
import { Subject, Observable, tap } from 'rxjs';

export interface LoginResponse {
  token: string;
  usuario: Usuario;
}

@Injectable({
  providedIn: 'root'
})
export class AutenticacionService {
  private API_URL = 'http://localhost:3000/appV1'; // Cambiar a URL real del backend 
  private LLAVE_USUARIOS = 'app_usuarios';
  private LLAVE_USUARIO_ACTUAL = 'app_usuario_actual';
  private LLAVE_TOKEN = 'jwt_token';

  // Notificador de cambios de usuario/sesión
  private usuarioCambioSubject = new Subject<Usuario | null>();
  public usuarioCambio$: Observable<Usuario | null> = this.usuarioCambioSubject.asObservable();

  constructor(private http: HttpClient) {
    this.inicializarBaseDatos();
  }

  // Crea el usuario ROOT por defecto si no existe ninguno
  private inicializarBaseDatos(): void {
    if (!localStorage.getItem(this.LLAVE_USUARIOS)) {
      const usuariosPorDefecto: Usuario[] = [
        {
          cc: 0,
          nombres: 'Usuario',
          apellidos: 'Root Sistema',
          email: 'root@aerolinea.com',
          username: 'root',
          password: '123',
          rol: 'ROOT'
        }
      ];
      localStorage.setItem(this.LLAVE_USUARIOS, JSON.stringify(usuariosPorDefecto));
    }
  }

  // Obtiene el token JWT guardado
  obtenerToken(): string | null {
    return localStorage.getItem(this.LLAVE_TOKEN);
  }

  // Obtiene la lista completa de usuarios (mock local)
  obtenerUsuarios(): Usuario[] {
    return JSON.parse(localStorage.getItem(this.LLAVE_USUARIOS) || '[]');
  }

  // Obtiene el usuario que inició sesión con validación de seguridad
  obtenerUsuarioActual(): Usuario | null {
    const usuarioData = localStorage.getItem(this.LLAVE_USUARIO_ACTUAL);
    
    if (!usuarioData || usuarioData === 'undefined' || usuarioData === 'null') {
      return null;
    }

    try {
      const usuario: Usuario = JSON.parse(usuarioData);
      if (usuario && usuario.rol) {
        return usuario;
      }
      return null;
    } catch (e) {
      localStorage.removeItem(this.LLAVE_USUARIO_ACTUAL);
      return null;
    }
  }

  // Historia 1: Iniciar sesión con JWT
  iniciarSesion(usuarioOEmail: string, clave: string): Observable<LoginResponse> {
    const body = { correo: usuarioOEmail, contrasena: clave };

    return this.http.post<LoginResponse>(`${this.API_URL}/login`, body).pipe(
      tap(respuesta => {
        // Guardamos el token JWT y los datos del usuario devueltos por el backend
        localStorage.setItem(this.LLAVE_TOKEN, respuesta.token);
        localStorage.setItem(this.LLAVE_USUARIO_ACTUAL, JSON.stringify(respuesta.usuario));
        this.usuarioCambioSubject.next(respuesta.usuario);
      })
    );
  }

  // Historia 2: Registrar un cliente
  registrarCliente(nuevoUsuario: Usuario): Observable<Usuario> {

    const payloadBackend = {
      username: nuevoUsuario.username,
      password: nuevoUsuario.password,
      email: nuevoUsuario.email,
      rol: nuevoUsuario.rol,
      
      // Convertimos explícitamente el string de la cédula a un número entero
      cc: Number(nuevoUsuario.cc), 
      
      nombres: nuevoUsuario.nombres,
      apellidos: nuevoUsuario.apellidos,
      
      // Aseguramos que los campos no se envíen vacíos si el usuario no los llenó
      fechaNacimiento: nuevoUsuario.fechaNacimiento || "2000-01-01", 
      lugarNacimiento: nuevoUsuario.lugarNacimiento || "No especificado",
      direccionFacturacion: nuevoUsuario.direccionFacturacion || "No especificada",
      genero: nuevoUsuario.genero || "No especificado",
      imagenUrl: nuevoUsuario.imagenUrl || "sin-imagen"
    };



    return this.http.post<Usuario>(`${this.API_URL}/usuario`, payloadBackend);
  }

// Historia 4: Recuperar contraseña
recuperarClave(email: string): Observable<any> {
  return this.http.post(`${this.API_URL}/autenticacion/recuperar-clave`, { email });
}

  // Historia 7: Crear un Administrador (Solo ROOT)
  crearAdministrador(nuevoAdmin: Usuario): Observable<Usuario> {
    return this.http.post<Usuario>(`${this.API_URL}/administracion/crear-admin`, nuevoAdmin);
  }

  // Historia 8: Eliminar Administrador (Solo ROOT)
  eliminarAdministrador(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/administracion/eliminar-admin/${id}`);
  }

// Historia 9: Ver lista de administradores
obtenerAdministradores(): Observable<Usuario[]> {
  return this.http.get<Usuario[]>(`${this.API_URL}/administracion/lista-administradores`);
}

  // Historias 5 y 6: Editar perfil
  actualizarPerfil(usuarioActualizado: Usuario): Observable<Usuario> {
    return this.http.put<Usuario>(`${this.API_URL}/usuario/perfil`, usuarioActualizado).pipe(
      tap(usuarioResp => {
        localStorage.setItem(this.LLAVE_USUARIO_ACTUAL, JSON.stringify(usuarioResp));
        this.usuarioCambioSubject.next(usuarioResp);
      })
    );
  }

  // Historia 3: Cerrar sesión
  cerrarSesion(): void {
    localStorage.removeItem(this.LLAVE_TOKEN);
    localStorage.removeItem(this.LLAVE_USUARIO_ACTUAL);
    this.usuarioCambioSubject.next(null);
  }
}