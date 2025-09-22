"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbstractEndpointHandler = void 0;
const common_model_1 = require("common-model");
const MessageHandler_1 = require("./MessageHandler");
const StreamHandler_1 = require("./StreamHandler");
class AbstractEndpointHandler {
    listenTopic;
    kafkaConfig;
    kafkaConsumerOptions;
    kafkaTopicOptions;
    uriList = [];
    constructor(listenTopic, kafkaConfig, kafkaConsumerOptions, kafkaTopicOptions) {
        this.listenTopic = listenTopic;
        this.kafkaConfig = kafkaConfig;
        this.kafkaConsumerOptions = kafkaConsumerOptions;
        this.kafkaTopicOptions = kafkaTopicOptions;
    }
    init() {
        const handle = new MessageHandler_1.MessageHandler();
        common_model_1.logger.info('Starting Kafka stream handler', this.listenTopic);
        new StreamHandler_1.StreamHandler(this.kafkaConfig, this.kafkaConsumerOptions, [this.listenTopic], (message) => handle.handle(message, this.handle), this.kafkaTopicOptions);
        this.uriList = this.matchingList();
    }
    handle(message, orgMessage) {
        if (message == null || message.data == null) {
            return Promise.reject(new common_model_1.Errors.SystemError());
        }
        const ctx = {
            id: message.msgHandlerUniqueId || `${message.transactionId}_${message.messageId}`,
            txId: `${message.transactionId}`,
            orgMsg: message,
            requestId: message.data?.rId,
        };
        common_model_1.logger.info('Handling request', message.uri);
        for (let uri of this.uriList) {
            if (uri.uri === message.uri) {
                return uri.handler(message.data, ctx);
            }
        }
        return Promise.reject(new common_model_1.Errors.UriNotFound());
    }
}
exports.AbstractEndpointHandler = AbstractEndpointHandler;
