export interface CompraReserva {
    idCompra?: number;
    codigoReserva?: string;
    idUsuario: number;
    montoTotal: number;
    estado: 'RESERVADO' | 'PAGADO' | 'CANCELADO' | 'EXPIRADO';
    metodoPago?: string; // 'BILLETERA', 'TARJETA', 'PENDIENTE', etc.
    fechaReserva?: string | Date;
    fechaLimitePago?: string | Date;
    idVuelo: number;
    fechaPago?: string | Date;
    }

    export interface PasajeroForm {
    nombreCompleto: string;
    documento: string;
    email: string;
    telefono: string;
    edad: number;
}