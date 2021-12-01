"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.injectWindow = void 0;
const ts_log_1 = require("ts-log");
const injectWindow = (window, wallet, logger = ts_log_1.dummyLogger) => {
    if (!window.cardano) {
        logger.debug({
            module: 'injectWindow',
            wallet: { name: wallet.name, version: wallet.version }
        }, 'Creating cardano global scope');
        window.cardano = {};
    }
    else {
        logger.debug({
            module: 'injectWindow',
            wallet: { name: wallet.name, version: wallet.version }
        }, 'Cardano global scope exists');
    }
    window.cardano[wallet.name] = window.cardano[wallet.name] || wallet.getPublicApi(window);
    logger.debug({
        module: 'injectWindow',
        wallet: { name: wallet.name, version: wallet.version },
        windowCardano: window.cardano
    }, 'Injected');
};
exports.injectWindow = injectWindow;
//# sourceMappingURL=injectWindow.js.map