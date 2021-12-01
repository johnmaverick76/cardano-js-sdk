"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUiWallet = void 0;
const ts_log_1 = require("ts-log");
const sendMessage_1 = require("./sendMessage");
const createUiWallet = (logger = ts_log_1.dummyLogger) => {
    const methodNames = [
        'getUtxos',
        'getBalance',
        'getUsedAddresses',
        'getUnusedAddresses',
        'getChangeAddress',
        'getRewardAddresses',
        'signTx',
        'signData',
        'submitTx'
    ];
    return (Object.fromEntries(methodNames.map((method) => [
        method,
        (...args) => sendMessage_1.sendMessage({ method, arguments: args }, logger)
    ])));
};
exports.createUiWallet = createUiWallet;
//# sourceMappingURL=uiWallet.js.map