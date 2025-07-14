export class ContractError extends Error {
    constructor(message: string, public code: string) {
        super(message);
        this.name = 'ContractError';
    }
}

export const CONTRACT_ERRORS = {
    INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
    INVALID_AMOUNT: 'INVALID_AMOUNT',
    INVALID_LINK_ID: 'INVALID_LINK_ID',
    INVALID_INVOICE_ID: 'INVALID_INVOICE_ID',
    LINK_NOT_FOUND: 'LINK_NOT_FOUND',
    INVOICE_NOT_FOUND: 'INVOICE_NOT_FOUND',
    LINK_ALREADY_PAID: 'LINK_ALREADY_PAID',
    INVOICE_ALREADY_PAID: 'INVOICE_ALREADY_PAID',
    TRANSACTION_FAILED: 'TRANSACTION_FAILED',
    NETWORK_ERROR: 'NETWORK_ERROR',
    INVALID_PRIVATE_KEY: 'INVALID_PRIVATE_KEY',
    UNAUTHORIZED: 'UNAUTHORIZED'
} as const;

export const handleContractError = (error: any) => {
    if (error instanceof ContractError) {
        return {
            success: false,
            error: {
                message: error.message,
                code: error.code
            }
        };
    }

    // Handle ethers.js errors
    if (error.code === 'INSUFFICIENT_FUNDS') {
        return {
            success: false,
            error: {
                message: 'Insufficient funds to complete the transaction',
                code: CONTRACT_ERRORS.INSUFFICIENT_FUNDS
            }
        };
    }

    if (error.code === 'NETWORK_ERROR') {
        return {
            success: false,
            error: {
                message: 'Network error occurred while processing the transaction',
                code: CONTRACT_ERRORS.NETWORK_ERROR
            }
        };
    }

    // Handle transaction failures
    if (error.message?.includes('transaction failed')) {
        return {
            success: false,
            error: {
                message: 'Transaction failed to execute',
                code: CONTRACT_ERRORS.TRANSACTION_FAILED
            }
        };
    }

    // Handle invalid private key
    if (error.message?.includes('invalid private key')) {
        return {
            success: false,
            error: {
                message: 'Invalid private key provided',
                code: CONTRACT_ERRORS.INVALID_PRIVATE_KEY
            }
        };
    }

    // Handle unauthorized access
    if (error.message?.includes('unauthorized')) {
        return {
            success: false,
            error: {
                message: 'Unauthorized access',
                code: CONTRACT_ERRORS.UNAUTHORIZED
            }
        };
    }

    // Default error
    return {
        success: false,
        error: {
            message: 'An unexpected error occurred',
            code: 'UNKNOWN_ERROR'
        }
    };
}; 