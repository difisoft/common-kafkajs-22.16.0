"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbstractKafkaController = void 0;
const common_model_1 = require("common-model");
const MessageHandler_1 = require("./MessageHandler");
const ConsumerHandler_1 = require("./ConsumerHandler");
const KafkaRequester_1 = require("./KafkaRequester");
class AbstractKafkaController {
    clusterId;
    kafkaOptions;
    consumerOptions;
    producerOptions;
    uriList = [];
    constructor(clusterId, kafkaOptions, consumerOptions, producerOptions) {
        this.clusterId = clusterId;
        this.kafkaOptions = kafkaOptions;
        this.consumerOptions = consumerOptions;
        this.producerOptions = producerOptions;
        // # bind methods to this
        this.init = this.init.bind(this);
        this.handle = this.handle.bind(this);
    }
    init() {
        const handle = new MessageHandler_1.MessageHandler(new KafkaRequester_1.ProducerCommon(this.clusterId, this.kafkaOptions, this.producerOptions));
        common_model_1.logger.info('Starting Kafka stream handler', this.clusterId);
        new ConsumerHandler_1.ConsumerHandler(this.kafkaOptions, {
            groupId: this.clusterId,
            ...this.consumerOptions
        }, [this.clusterId], (message) => handle.handle(message, this.handle), () => {
            common_model_1.logger.info('Kafka stream handler ready');
        });
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
exports.AbstractKafkaController = AbstractKafkaController;
