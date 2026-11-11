    import { Injectable, inject } from '@angular/core';
    import { HttpClient } from '@angular/common/http';
    import { Observable, map } from 'rxjs';
    import { Silla, AsignarSillaPasajeroDto, RespuestaAsignacionSilla, EstadoSillaBD } from '../modelos/asignacion-sillas.model';

    @Injectable({
    providedIn: 'root'
    })
    export class SillaService {
    private http = inject(HttpClient);
    private apiUrl = 'http://localhost:3000/appV1';

    /**
     * Obtiene la matriz completa de sillas registradas para un vuelo específico
     * Mapea en camelCase y normaliza los 4 estados requeridos por la UI
     */
    obtenerSillasPorVuelo(idVuelo: number): Observable<Silla[]> {
        return this.http.get<any[]>(`${this.apiUrl}/sillas/vuelo/${idVuelo}`).pipe(
        map(sillasBackend => {
            const lista = Array.isArray(sillasBackend) ? sillasBackend : [];
            return lista.map((s: any) => {
            const estadoOriginal = String(s.estado || 'DISPONIBLE').toUpperCase();
            let estadoNormalizado: EstadoSillaBD = 'DISPONIBLE';

            if (estadoOriginal.includes('NO') || estadoOriginal.includes('INHABILITADO') || estadoOriginal.includes('BLOQUEAD')) {
                estadoNormalizado = 'NO_DISPONIBLE';
            } else if (estadoOriginal.includes('RESERVAD') || estadoOriginal.includes('OCUPAD')) {
                estadoNormalizado = 'RESERVADO';
            } else if (estadoOriginal.includes('ASIGNAD')) {
                estadoNormalizado = 'ASIGNADO';
            }

            return {
                idSilla: Number(s.id_silla || s.idSilla || s.id || 0),
                idVuelo: Number(s.id_vuelo || s.idVuelo || idVuelo),
                numeroSilla: String(s.numero_silla || s.numeroSilla || s.numero || ''),
                clase: String(s.clase || 'ECONOMICA').toUpperCase(),
                estado: estadoNormalizado
            };
            });
        })
        );
    }

    /**
     * Registra o actualiza la asignación de la silla seleccionada en la BD
     */
    asignarSillaAPasajero(dto: AsignarSillaPasajeroDto): Observable<RespuestaAsignacionSilla> {
        return this.http.post<RespuestaAsignacionSilla>(`${this.apiUrl}/sillas/asignar`, {
        idReserva: dto.idReserva,
        idPasajero: dto.idPasajero,
        idSilla: dto.idSilla,
        numeroSilla: dto.numeroSilla
        });
    }

    /**
     * Endpoint alternativo de actualización mediante PATCH
     */
    actualizarSillaReserva(idReserva: number, idPasajero: number, idSilla: number): Observable<any> {
        return this.http.patch<any>(`${this.apiUrl}/compra-reserva/${idReserva}/pasajero/${idPasajero}/silla`, {
        idSilla: idSilla
        });
    }
    }