"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageHandler = void 0;
exports.getErrorMessage = getErrorMessage;
const common_model_1 = require("common-model");
class MessageHandler {
    producer;
    activeRequestMap = {};
    timeoutinMs;
    requestId = new Date().getTime();
    constructor(producer, timeoutinMs) {
        this.producer = producer;
        this.timeoutinMs = timeoutinMs;
        if (this.timeoutinMs == null && process.env.TRADEX_ENV_DEFAULT_REQUEST_TIMEOUT != null && process.env.TRADEX_ENV_DEFAULT_REQUEST_TIMEOUT !== '') {
            try {
                this.timeoutinMs = parseInt(process.env.TRADEX_ENV_DEFAULT_REQUEST_TIMEOUT, 10);
            }
            catch (e) {
                common_model_1.logger.error("wrong timeout setting", process.env.TRADEX_ENV_DEFAULT_REQUEST_TIMEOUT);
            }
        }
    }
    getMsgHandlerUniqueId(msg) {
        if (msg.msgHandlerUniqueId == null) {
            msg.msgHandlerUniqueId = `${msg.transactionId}_${msg.messageId}_${this.requestId}`;
        }
        return msg.msgHandlerUniqueId;
    }
    getActiveMessage = (msgId) => {
        return this.activeRequestMap[msgId];
    };
    handle = (message, func) => {
        if (message.value == null) {
            return;
        }
        const msgString = message.value.toString();
        try {
            const startTime = process.hrtime();
            let diff = null;
            common_model_1.logger.info(`receive msg: ${msgString}`);
            const msg = JSON.parse(msgString);
            if (msg.t != null && this.timeoutinMs != null && new Date().getTime() - msg.t > this.timeoutinMs) {
                common_model_1.logger.warn(`ignore ${msg.uri} ${msg.transactionId} - ${msg.messageId} since it's time out`);
                return;
            }
            if (msg.et != null && new Date().getTime() > msg.et) {
                common_model_1.logger.warn(`ignore ${msg.uri} ${msg.transactionId} - ${msg.messageId} since it's time out`);
                return;
            }
            const shouldResponse = this.shouldResponse(msg);
            if (shouldResponse && msg.uri === "/healthcheck") {
                this.producer.sendResponse(msg.transactionId, msg.messageId, msg.responseDestination.topic, msg.responseDestination.uri, {
                    status: "ON",
                });
                return;
            }
            this.requestId += 1;
            this.activeRequestMap[this.getMsgHandlerUniqueId(msg)] = msg;
            const obs = func(msg, message);
            if (obs === false) {
                if (shouldResponse) {
                    diff = process.hrtime(startTime);
                    common_model_1.logger.info(`process request ${msg.uri} took ${diff[0]}.${diff[1]} seconds`);
                    this.producer.sendResponse(msg.transactionId, msg.messageId, msg.responseDestination.topic, msg.responseDestination.uri, this.getErrorMessage(new common_model_1.Errors.UriNotFound()));
                }
                delete this.activeRequestMap[this.getMsgHandlerUniqueId(msg)];
                return;
            }
            else if (obs === true) {
                diff = process.hrtime(startTime);
                common_model_1.logger.info(`forward request ${msg.transactionId} ${msg.messageId} ${msg.uri} took ${diff[0]}.${diff[1]} seconds`);
                delete this.activeRequestMap[this.getMsgHandlerUniqueId(msg)];
                return; // forwarding. do nothing
            }
            else {
                const handleError = (err) => {
                    common_model_1.logger.error(`error while processing request ${msg.transactionId} ${msg.messageId} ${msg.uri}`, err);
                    delete this.activeRequestMap[this.getMsgHandlerUniqueId(msg)];
                    if (err instanceof common_model_1.Errors.NoForwardResponseError) {
                        return;
                    }
                    if (shouldResponse) {
                        this.producer.sendResponse(msg.transactionId, msg.messageId, msg.responseDestination.topic, msg.responseDestination.uri, this.getErrorMessage(err));
                    }
                    diff = process.hrtime(startTime);
                    common_model_1.logger.info(`handle request ${msg.transactionId} ${msg.messageId} ${msg.uri} took ${diff[0]}.${diff[1]} seconds`);
                };
                const handleData = (data) => {
                    delete this.activeRequestMap[this.getMsgHandlerUniqueId(msg)];
                    try {
                        if (shouldResponse) {
                            this.producer.sendResponse(msg.transactionId, msg.messageId, msg.responseDestination.topic, msg.responseDestination.uri, { data: data });
                        }
                        diff = process.hrtime(startTime);
                        common_model_1.logger.info(`handle request ${msg.uri} took ${diff[0]}.${diff[1]} seconds`);
                    }
                    catch (err) {
                        if (err instanceof Error) {
                            handleError(err);
                        }
                        else {
                            handleError(new Error(JSON.stringify(err)));
                        }
                    }
                };
                if (obs instanceof Promise) {
                    obs.then(handleData).catch(handleError);
                }
            }
        }
        catch (e) {
            common_model_1.logger.error(`error while processing message ${message.topic} ${message.value} ${msgString}`, e);
        }
    };
    getErrorMessage = (error) => {
        return getErrorMessage(error);
    };
    shouldResponse(msg) {
        return msg.responseDestination != null && msg.responseDestination.topic != null;
    }
}
exports.MessageHandler = MessageHandler;
function getErrorMessage(err) {
    if (err instanceof common_model_1.Errors.GeneralError) {
        const error = err;
        if (error.isSystemError) {
            if (error.source) {
                common_model_1.logger.error('error', error.source);
            }
            else {
                common_model_1.logger.error('error', error);
            }
            return common_model_1.Models.createFailResponse(error.code, error.messageParams, (error.params && error.params.length > 0) ? error.params : undefined);
        }
        else if (error instanceof common_model_1.Errors.ForwardError) {
            return { status: error.status };
        }
        else {
            common_model_1.logger.error('error', error);
            return common_model_1.Models.createFailResponse('INTERNAL_SERVER_ERROR');
        }
    }
    else {
        return getErrorMessage(new common_model_1.Errors.GeneralError());
    }
}
