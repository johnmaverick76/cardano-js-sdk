import { CustomError } from 'ts-custom-error';
declare enum TxSignErrorCode {
    ProofGeneration = 1,
    UserDeclined = 2
}
export declare class TxSignError extends CustomError {
    code: TxSignErrorCode;
    info: string;
    constructor(code: TxSignErrorCode, info: string);
}
export {};
//# sourceMappingURL=TxSignError.d.ts.map