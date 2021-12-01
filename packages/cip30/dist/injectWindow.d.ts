import { Wallet, WalletPublic } from './Wallet';
import { Logger } from 'ts-log';
export declare type WindowMaybeWithCardano = Window & {
    cardano?: {
        [k: string]: WalletPublic;
    };
};
export declare const injectWindow: (window: WindowMaybeWithCardano, wallet: Wallet, logger?: Logger) => void;
//# sourceMappingURL=injectWindow.d.ts.map