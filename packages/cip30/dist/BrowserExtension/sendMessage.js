"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMessage = void 0;
const webextension_polyfill_1 = __importDefault(require("webextension-polyfill"));
const ts_log_1 = require("ts-log");
const sendMessage = (msg, logger = ts_log_1.dummyLogger) => {
    logger.debug('sendMessage', msg);
    try {
        return webextension_polyfill_1.default.runtime.sendMessage(msg);
    }
    catch (error) {
        logger.error('sendMessage', error);
        throw error;
    }
};
exports.sendMessage = sendMessage;
//# sourceMappingURL=sendMessage.js.map