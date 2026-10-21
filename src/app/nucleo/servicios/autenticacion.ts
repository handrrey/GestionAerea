import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Usuario, UsuarioCreadoResponse } from '../modelos/usuario.model';
import { Subject, Observable, tap } from 'rxjs';

export interface LoginResponse {
  access_token: string;
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
          usuario: 'root',
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

    console.log("Datos del usuario actual obtenidos de localStorage:", usuarioData);
    
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

  // obtener todos los datos del usuario para su pefil
  obtenerPerfilUsuario(id: number): Observable<Usuario>{
    const token = this.obtenerToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.get<Usuario>(`${this.API_URL}/usuario/${id}`, { headers });
  }

  // Historia 1: Iniciar sesión con JWT (listo)
  iniciarSesion(usuarioOCorreo: string, clave: string): Observable<LoginResponse> {
    const body = { email: usuarioOCorreo, contrasena: clave };

    return this.http.post<any>(`${this.API_URL}/login`, body).pipe(
      tap(respuesta => {
        // Usamos respuesta.access_token o respuesta.token (con respaldo)
        const token = respuesta.access_token || respuesta.token;
        
        localStorage.setItem(this.LLAVE_TOKEN, token);
        localStorage.setItem(this.LLAVE_USUARIO_ACTUAL, JSON.stringify(respuesta.usuario));
        this.usuarioCambioSubject.next(respuesta.usuario);
      })
    );
  }

  // Historia 2: Registrar un cliente (listo)
  registrarCliente(nuevoUsuario: Usuario): Observable<UsuarioCreadoResponse> {
    const payloadBackend = {
      usuario: nuevoUsuario.usuario,
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



    return this.http.post<UsuarioCreadoResponse>(`${this.API_URL}/usuario`, payloadBackend);
  }

// Historia 4: Recuperar contraseña
  recuperarClave(correo: string): Observable<any> {
    return this.http.post(`${this.API_URL}/autenticacion/recuperar-clave`, { correo });
  }

  // Historia 7: Crear un Administrador (Solo ROOT) (listo sin validacion de solo root)
  crearAdministrador(nuevoAdmin: Usuario): Observable<UsuarioCreadoResponse> {
    return this.http.post<UsuarioCreadoResponse>(`${this.API_URL}/usuario`, nuevoAdmin);
  }

  // Historia 8: Eliminar Administrador (Solo ROOT)
  eliminarAdministrador(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/usuario/${id}`);
  }

// Historia 9: Ver lista de administradores (listo)
  obtenerAdministradores(): Observable<Usuario[]> {
    const token = this.obtenerToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.get<Usuario[]>(`${this.API_URL}/usuario/listaAdministradores`, { headers });
  }

  // Historias 5 y 6: Editar perfil (listo)
  actualizarPerfil(usuarioActualizado: Partial<Usuario>): Observable<Usuario> {
    return this.http.patch<Usuario>(`${this.API_URL}/usuario`, usuarioActualizado).pipe(
      tap(usuarioResp => {
        localStorage.setItem(this.LLAVE_USUARIO_ACTUAL, JSON.stringify(usuarioResp));
        this.usuarioCambioSubject.next(usuarioResp);
      })
    );
  }

  // Historia 3: Cerrar sesión (listo)
  cerrarSesion(): void {
    localStorage.removeItem(this.LLAVE_TOKEN);
    localStorage.removeItem(this.LLAVE_USUARIO_ACTUAL);
    this.usuarioCambioSubject.next(null);
  }
}