"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMessages = void 0;
const ts_log_1 = require("ts-log");
const webextension_polyfill_1 = __importDefault(require("webextension-polyfill"));
const handleMessages = (walletApi, logger = ts_log_1.dummyLogger) => {
    webextension_polyfill_1.default.runtime.onMessage.addListener(async (msg) => {
        logger.debug('new message received: ', msg);
        const walletMethod = walletApi[msg.method];
        if (!walletMethod) {
            logger.error(`No method implemented for ${msg.method}`);
            return;
        }
        return walletMethod(...msg.arguments);
    });
};
exports.handleMessages = handleMessages;
//# sourceMappingURL=handleMessages.js.map