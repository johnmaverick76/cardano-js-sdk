import { WalletApi } from './types';
import { Logger } from 'ts-log';
import { WindowMaybeWithCardano } from '../injectWindow';
export declare type SpecificationVersion = string;
export declare type WalletName = string;
export declare type WalletProperties = {
    name: WalletName;
    version: SpecificationVersion;
};
export declare type RequestAccess = () => Promise<boolean>;
export declare type WalletOptions = {
    logger?: Logger;
    persistAllowList?: boolean;
    storage?: Storage;
};
export declare class Wallet {
    private api;
    private requestAccess;
    readonly version: SpecificationVersion;
    readonly name: WalletName;
    private allowList;
    private logger;
    private readonly options;
    constructor(properties: WalletProperties, api: WalletApi, requestAccess: RequestAccess, options?: WalletOptions);
    getPublicApi(window: WindowMaybeWithCardano): {
        name: string;
        version: string;
        enable: () => Promise<WalletApi>;
        isEnabled: () => Promise<Boolean>;
    };
    private getAllowList;
    private allowApplication;
    isEnabled(window: WindowMaybeWithCardano): Promise<Boolean>;
    enable(window: WindowMaybeWithCardano): Promise<WalletApi>;
}
export declare type WalletPublic = ReturnType<Wallet['getPublicApi']>;
//# sourceMappingURL=Wallet.d.ts.map