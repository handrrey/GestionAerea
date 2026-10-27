// src/app/nucleo/servicios/vuelos.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Vuelo } from '../modelos/vuelos.model';

export interface FiltrosBusqueda {
  origen?: string;
  destino?: string;
  fecha?: string;
  precioMaximo?: number;
}

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

// ----- BUSQUEDA DE VUELOS PARAMETRIZADA -----
  buscarVuelosParametrizados(filtros: FiltrosBusqueda): Observable<Vuelo[]> {
    let params = new HttpParams();

    if (filtros.origen) {
      // Si el select envía "Pereira (PEI)", extraemos solo "Pereira" para coincidir con la BD
      const origenLimpio = filtros.origen.split('(')[0].trim();
      params = params.set('origen', origenLimpio);
    }

    if (filtros.destino) {
      const destinoLimpio = filtros.destino.split('(')[0].trim();
      params = params.set('destino', destinoLimpio);
    }

    if (filtros.fecha) {
      params = params.set('fecha', filtros.fecha);
    }

    if (filtros.precioMaximo && filtros.precioMaximo > 0) {
      params = params.set('precioMaximo', filtros.precioMaximo.toString());
    }

    // Petición GET enviando los Query Params
    return this.http.get<Vuelo[]>(`${this.API_URL}/busquedaParametrizada`, { params });
  }
}