// src/app/nucleo/servicios/vuelos.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Vuelo } from '../modelos/vuelos.model';

@Injectable({ providedIn: 'root' })
export class VuelosService {
  private API_URL = 'http://localhost:3000/appV1/vuelos'; // Ajusta de backend

  constructor(private http: HttpClient) {}

  obtenerVuelos(): Observable<Vuelo[]> {
    return this.http.get<Vuelo[]>(`${this.API_URL}`);
  }

  crearVuelo(vuelo: Vuelo): Observable<Vuelo> {
    return this.http.post<Vuelo>(`${this.API_URL}`, vuelo);
  }

  editarVuelo(id: number, vuelo: Vuelo): Observable<Vuelo> {
    return this.http.patch<Vuelo>(`${this.API_URL}/${id}`, vuelo);
  }

  cancelarVuelo(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${id}`);
  }

 
  buscarVuelosPorRuta(origen: string, destino: string, fecha: string): Observable<Vuelo[]> {
    // Ajusta los parámetros según cómo los reciba el backend 
    return this.http.get<Vuelo[]>(`${this.API_URL}/buscar?origen=${origen}&destino=${destino}&fecha=${fecha}`);
}
}