import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CompraReserva } from '../modelos/compra-reserva.model';

@Injectable({
  providedIn: 'root'
})
export class CompraReservaService {

  private apiUrl = 'http://localhost:3000/appV1/compra-reserva';

  constructor(private http: HttpClient) {}

  // Crear Reserva (24 horas)
  crearReserva(payload: CompraReserva): Observable<CompraReserva> {
    return this.http.post<CompraReserva>(this.apiUrl, payload);
  }

  // Futura implementación de Compra Directa con Billetera / Tarjeta
  procesarCompraDirecta(payload: CompraReserva): Observable<CompraReserva> {
    return this.http.post<CompraReserva>(`${this.apiUrl}/compra`, payload);
  }

  // Obtener historial de compras y reservas por usuario
  obtenerHistorialPorUsuario(idUsuario: number): Observable<CompraReserva[]> {
    return this.http.get<CompraReserva[]>(`${this.apiUrl}/usuario/${idUsuario}`);
  }
}