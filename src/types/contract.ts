export enum PaymentLinkStatus {
    ACTIVE = 0,
    PAID = 1,
    CANCELLED = 2
}

export interface GlobalPaymentLink {
    creator: string;
    link: string;
}

export interface FixedPaymentLink {
    creator: string;
    link: string;
    amount: bigint;
    status: PaymentLinkStatus;
}

export interface Invoice {
    invoiceId: string;
    productId: string;
    from: string;
    amount: bigint;
    status: PaymentLinkStatus;
}

export interface ContractResponse<T> {
    success: boolean;
    error?: any;
    data?: T;
}

export interface TransactionResponse {
    success: boolean;
    error?: any;
    txHash?: string;
} 