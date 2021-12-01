import { Logger } from 'ts-log';
import { Message } from './types';
import { WalletApi } from '../Wallet';
export declare const sendMessage: (msg: Message, logger?: Logger) => Promise<WalletApi[keyof WalletApi]>;
//# sourceMappingURL=sendMessage.d.ts.map