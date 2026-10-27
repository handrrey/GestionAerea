import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { EstadoBilletera, Tarjeta, Transaccion } from '../modelos/billetera-virtual.model';

@Injectable({
  providedIn: 'root'
})
export class BilleteraService {

  private apiUrl = 'http://localhost:3000/billetera';

  constructor(private http: HttpClient) {}

  obtenerEstadoBilletera(idUsuario: number): Observable<EstadoBilletera> {
    return this.http.get<EstadoBilletera>(`${this.apiUrl}/usuario/${idUsuario}`);
  }

  recargarSaldo(idUsuario: number, monto: number, idTarjeta: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/recargar`, { idUsuario, monto, idTarjeta });
  }

  agregarTarjeta(idUsuario: number, payload: any): Observable<Tarjeta> {
    return this.http.post<Tarjeta>(`${this.apiUrl}/tarjetas`, { idUsuario, ...payload });
  }

  eliminarTarjeta(idTarjeta: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/tarjetas/${idTarjeta}`);
  }

  obtenerHistorial(idUsuario: number): Observable<Transaccion[]> {
    return this.http.get<Transaccion[]>(`${this.apiUrl}/historial/${idUsuario}`);
  }
}