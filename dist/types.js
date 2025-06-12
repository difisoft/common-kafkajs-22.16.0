"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STREAM_STATE = exports.PromiseState = exports.MessageType = void 0;
var MessageType;
(function (MessageType) {
    MessageType["MESSAGE"] = "MESSAGE";
    MessageType["REQUEST"] = "REQUEST";
    MessageType["RESPONSE"] = "RESPONSE";
})(MessageType || (exports.MessageType = MessageType = {}));
class PromiseState {
    rs;
    rj;
    prom;
    constructor() {
        // tslint:disable
        this.prom = new Promise((resolve, reject) => {
            this.rs = resolve;
            this.rj = reject;
        });
        // tslint:enable
    }
    resolve(v) {
        this.rs?.(v);
    }
    reject(err) {
        this.rj?.(err);
    }
    promise() {
        return this.prom;
    }
}
exports.PromiseState = PromiseState;
const STREAM_STATE = {
    NORMAL: "NORMAL",
    FINSISH: "FINSISH",
    ERROR: "ERROR",
};
exports.STREAM_STATE = STREAM_STATE;
