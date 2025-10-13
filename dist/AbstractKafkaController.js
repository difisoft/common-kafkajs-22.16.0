"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbstractKafkaController = void 0;
exports.convertContextType = convertContextType;
exports.generateOperatorId = generateOperatorId;
const common_model_1 = require("common-model");
const MessageHandler_1 = require("./MessageHandler");
const ConsumerHandler_1 = require("./ConsumerHandler");
const types_1 = require("./types");
const KafkaRequester_1 = require("./KafkaRequester");
function convertContextType(ctx, data) {
    return {
        id: ctx.id,
        txId: ctx.txId,
        orgMsg: (0, types_1.convertMessageType)(ctx.orgMsg, data),
        requestId: ctx.requestId,
    };
}
// 1. Break serviceName into words (split kebab and camelcase)
function splitServiceName(name) {
    // split kebab-case first
    let parts = name.split('-');
    // further split each part by camelCase
    let camelParts = [];
    for (const part of parts) {
        camelParts.push(...part.split(/(?=[A-Z])/));
    }
    return camelParts.filter(Boolean);
}
// 2. For URI, split into method and path, then split path by / and remove empty parts
function splitUri(uri) {
    let [method, path] = uri.split(':', 2);
    let parts = [];
    if (method) {
        parts.push(method);
    }
    if (path) {
        parts.push(...path.split('/').filter(Boolean));
    }
    return parts;
}
function generateOperatorId(serviceName, uri) {
    // Convert serviceName (camelCase or kebab-case) and uri ("get:api/v1/foo") to ABC_DEF_GHI_OPQ_URIPARTS
    // Example: serviceName = "myService-qweRty", uri = "get:api/v1/favourites" 
    // result: MY_SERVICE_QWE_RTY_GET_API_V1_FAVOURITES
    const nameParts = splitServiceName(serviceName);
    const uriParts = splitUri(uri);
    // Concatenate, uppercase, join by _
    return [...nameParts, ...uriParts]
        .map(x => x.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())
        .filter(Boolean)
        .join('_');
}
class AbstractKafkaController {
    serviceName;
    clusterId;
    kafkaOptions;
    consumerOptions;
    producerOptions;
    uriList = [];
    constructor(serviceName, clusterId, kafkaOptions, consumerOptions, producerOptions) {
        this.serviceName = serviceName;
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
