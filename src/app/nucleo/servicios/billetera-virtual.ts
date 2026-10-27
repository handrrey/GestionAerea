import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { EstadoBilletera, Tarjeta, Transaccion } from '../modelos/billetera-virtual.model';

@Injectable({
  providedIn: 'root'
})
export class BilleteraService {

  private apiUrl = 'http://localhost:3000/appV1';

  constructor(private http: HttpClient) {}

  obtenerEstadoBilletera(idUsuario: number): Observable<EstadoBilletera> {
    return this.http.get<EstadoBilletera>(`${this.apiUrl}/billetera/${idUsuario}`);
  }

  recargarSaldo(idUsuario: number, monto: number, idTarjeta: number): Observable<any> {
    return this.http.patch(`${this.apiUrl}/billetera`, { idUsuario, monto, idTarjeta });
  }

  agregarTarjeta(idUsuario: number, payload: any): Observable<Tarjeta> {
    return this.http.post<Tarjeta>(`${this.apiUrl}/billetera`, { idUsuario, ...payload });
  }

  eliminarTarjeta(idTarjeta: number, idUsuario: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/billetera/${idTarjeta}?idUsuario=${idUsuario}`);
  }

  obtenerHistorial(idUsuario: number): Observable<Transaccion[]> {
    return this.http.get<Transaccion[]>(`${this.apiUrl}/billetera/historial/${idUsuario}`);
  }
}