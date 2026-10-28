export interface Tarjeta {
    idTarjeta?: number;
    idBilletera?: number;
    numeroTarjeta: string;
    tipoTarjeta: string; // Crédito, Débito, etc.
    franquicia: string;   // Visa, Mastercard, etc.
    fechaExpiracion: string | Date;
}

export interface BilleteraFinanciera {
    idBilletera?: number;
    idUsuario: number;
    saldo: number;
    tarjetas?: Tarjeta[];
}

export interface Transaccion {
    idTransaccion?: number;
    concepto: string;
    fecha: string;
    monto: number;
    tipo: 'RECARGA' | 'COMPRA' | 'REEMBOLSO';
    alteraSaldo?: boolean;
    referencia?: string;
}

export interface EstadoBilletera {
    billetera: BilleteraFinanciera;
    tarjetas: Tarjeta[];
    historial: Transaccion[];
}