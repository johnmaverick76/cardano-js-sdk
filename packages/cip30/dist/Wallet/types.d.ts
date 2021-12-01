import Schema from '@cardano-ogmios/schema';
import { Bytes, Cbor, Paginate } from '../types';
export declare type GetUtxos = (amount?: Cbor, paginate?: Paginate) => Promise<Schema.Utxo | undefined>;
export declare type GetBalance = () => Promise<Cbor>;
export declare type GetUsedAddresses = (paginate?: Paginate) => Promise<Cbor[]>;
export declare type GetUnusedAddresses = () => Promise<Cbor[]>;
export declare type GetChangeAddress = () => Promise<Cbor>;
export declare type GetRewardAddresses = () => Promise<Cbor[]>;
export declare type SignTx = (tx: Cbor, partialSign?: Boolean) => Promise<Cbor>;
export declare type SignData = (addr: Cbor, sigStructure: Cbor) => Promise<Bytes>;
export declare type SubmitTx = (tx: Cbor) => Promise<string>;
export interface WalletApi {
    getUtxos: GetUtxos;
    getBalance: GetBalance;
    getUsedAddresses: GetUsedAddresses;
    getUnusedAddresses: GetUnusedAddresses;
    getChangeAddress: GetChangeAddress;
    getRewardAddresses: GetRewardAddresses;
    signTx: SignTx;
    signData: SignData;
    submitTx: SubmitTx;
}
//# sourceMappingURL=types.d.ts.map