    export interface PasajeroForm {
    nombreCompleto: string;
    documento: string;
    fechaNacimiento: string;
    genero: string;
    telefono: string;
    email: string;
    nombreContacto: string;
    telefonoContacto: string;
    edad: number;
    }

    export interface CompraReserva {
    idCompra?: number;
    codigoReserva?: string;
    idUsuario: number;
    montoTotal: number;
    estado: 'Pendiente' | 'Pagado' | 'Cancelado' | 'Expirado' | 'RESERVADO' | 'PAGADO';
    metodoPago?: string;
    fechaReserva?: string | Date;
    fechaLimitePago?: string | Date;
    idVuelo: number;
    fechaPago?: string | Date;
    clase?: 'ECONOMICA' | 'PRIMERA_CLASE';
    cantidadPasajeros?: number;
    pasajeros?: PasajeroForm[];
    }