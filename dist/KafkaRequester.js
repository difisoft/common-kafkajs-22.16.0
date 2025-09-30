"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProducerCommon = exports.KafkaRequester = void 0;
exports.create = create;
exports.getInstance = getInstance;
exports.getResponse = getResponse;
const ConsumerHandler_1 = require("./ConsumerHandler");
const common_model_1 = require("common-model");
const types_1 = require("./types");
const kafkajs_1 = require("kafkajs");
class ProducerCommon {
    clusterId;
    kafkaOptions;
    producerOptions;
    handleSendError;
    readyStatusUpdate;
    messageId = 0;
    producer;
    bufferedMessages = [];
    producerReady = false;
    preferBatch;
    constructor(clusterId, kafkaOptions, producerOptions, handleSendError, readyStatusUpdate, preferBatch) {
        this.clusterId = clusterId;
        this.kafkaOptions = kafkaOptions;
        this.producerOptions = producerOptions;
        this.handleSendError = handleSendError;
        this.readyStatusUpdate = readyStatusUpdate;
        this.preferBatch = preferBatch ?? false;
        const kafka = new kafkajs_1.Kafka(this.kafkaOptions);
        this.producer = kafka.producer(this.producerOptions);
        this.connect();
    }
    async connect() {
        try {
            await this.producer.connect();
            common_model_1.logger.info(this.preferBatch ? "high latency producer connect" : "low latency producer connect");
            this.changeProducerStatus(true);
            this.bufferedMessages.forEach(this.reallySendMessage);
        }
        catch (error) {
            common_model_1.logger.error("Failed to connect producer", error);
            this.changeProducerStatus(false);
        }
    }
    changeProducerStatus(isReady) {
        this.producerReady = isReady;
        this.readyStatusUpdate?.(this.producerReady);
    }
    sendMessage(transactionId, topic, uri, data) {
        const message = this.createMessage(transactionId, topic, uri, data);
        this.sendMessageCheckReady(message);
    }
    ;
    sendRaw(topic, data) {
        const message = {
            raw: true,
            message: data,
            topic: topic,
        };
        this.sendMessageCheckReady(message);
    }
    ;
    sendForwardMessage(originMessage, newTopic, newUri) {
        const message = {
            topic: newTopic,
            message: originMessage
        };
        message.message.uri = newUri;
        this.sendMessageCheckReady(message);
    }
    ;
    sendResponse(transactionId, messageId, topic, uri, data) {
        const message = this.createMessage(transactionId, topic, uri, data, types_1.MessageType.RESPONSE, undefined, undefined, messageId);
        this.sendMessageCheckReady(message);
    }
    ;
    sendMessageCheckReady(message) {
        if (!this.producerReady) {
            this.bufferedMessages.push(message);
            return;
        }
        this.reallySendMessage(message);
    }
    timeout(message) {
        // do nothing
    }
    async doReallySendMessage(message) {
        try {
            const msgContent = JSON.stringify(message.message);
            common_model_1.logger.info(`send low latency message ${msgContent} to topic ${message.topic}`);
            const record = {
                topic: message.topic,
                messages: [{
                        value: Buffer.from(msgContent),
                        timestamp: Date.now().toString()
                    }]
            };
            await this.producer.send(record);
            if (message.timeout) {
                setTimeout(() => this.timeout(message), message.timeout);
            }
        }
        catch (e) {
            if (!this.handleSendError || !this.handleSendError(e)) {
                common_model_1.logger.error("error while sending the message", e);
            }
        }
    }
    reallySendMessage = (message) => {
        this.doReallySendMessage(message);
    };
    getMessageId() {
        this.messageId++;
        return `${this.messageId}`;
    }
    createMessage(transactionId, topic, uri, data, messageType = types_1.MessageType.MESSAGE, responseTopic, responseUri, messageId, timeout) {
        return {
            topic: topic,
            message: {
                messageType: messageType,
                sourceId: this.clusterId,
                messageId: messageId ? messageId : this.getMessageId(),
                transactionId: transactionId,
                uri: uri,
                responseDestination: responseTopic ? {
                    topic: responseTopic,
                    uri: responseUri
                }
                    :
                        undefined,
                data: data,
                t: timeout != null ? undefined : new Date().getTime(),
                et: timeout == null ? undefined : new Date().getTime() + timeout,
            }
        };
    }
    ;
}
exports.ProducerCommon = ProducerCommon;
class KafkaRequester extends ProducerCommon {
    clientId;
    requestedMessages = new Map();
    expiredIn = 0;
    responseTopic;
    consumerReady = false;
    constructor(clusterId, clientId, kafkaOptions, consumerOptions, producerOptions, initListener = true, topicConf = {}, handleSendError, readyCallback, expiredIn, preferBatch) {
        super(clusterId, kafkaOptions, producerOptions, handleSendError, readyCallback, preferBatch);
        this.clientId = clientId;
        this.responseTopic = `${this.clusterId}.response.${this.clientId}`;
        this.expiredIn = expiredIn ? expiredIn : 10000;
        if (initListener) {
            common_model_1.logger.info(`init response listener ${this.responseTopic}`);
            const topicOps = { ...topicConf, "auto.offset.reset": "earliest" };
            new ConsumerHandler_1.ConsumerHandler(this.kafkaOptions, {
                groupId: this.clientId,
                ...consumerOptions
            }, [this.responseTopic], (data) => this.handlerResponse(data), () => {
                common_model_1.logger.info("response consumer ready");
                this.consumerReady = true;
                this.fireStatus();
            });
        }
        else {
            this.consumerReady = true;
            this.fireStatus();
        }
    }
    getResponseTopic() {
        return this.responseTopic;
    }
    changeProducerStatus(isReady) {
        this.producerReady = isReady;
        this.fireStatus();
    }
    fireStatus() {
        this.readyStatusUpdate?.(this.consumerReady && this.producerReady);
    }
    async sendRequest(transactionId, topic, uri, data, timeout) {
        return this.sendRequestAsync(transactionId, topic, uri, data, timeout);
    }
    async sendRequestAsync(transactionId, topic, uri, data, timeout) {
        const promise = new types_1.PromiseState();
        this.sendRequestBase(transactionId, topic, uri, data, promise, timeout);
        return promise.promise();
    }
    ;
    sendRequestBase(transactionId, topic, uri, data, subject, timeout) {
        const message = this.createMessage(transactionId, topic, uri, data, types_1.MessageType.REQUEST, this.responseTopic, "REQUEST_RESPONSE", undefined, timeout);
        message.subject = subject;
        message.timeout = timeout;
        if (!this.producerReady) {
            this.bufferedMessages.push(message);
        }
        else {
            this.reallySendMessage(message);
        }
    }
    ;
    reallySendMessage = (message) => {
        if (message.subject) {
            this.requestedMessages.set(message.message.messageId, message);
        }
        super.doReallySendMessage(message);
    };
    timeout(message) {
        const msgId = message.message.messageId;
        if (this.requestedMessages.has(msgId)) {
            this.respondError(message, new common_model_1.Errors.TimeoutError());
            this.requestedMessages.delete(msgId);
        }
    }
    respondData(message, data) {
        if (message.subject == null) {
            return;
        }
        message.subject.resolve(data);
    }
    respondError(message, err) {
        if (message.subject == null) {
            return;
        }
        message.subject.reject(err);
    }
    handlerResponse(message) {
        const msgStr = message.value.toString();
        try {
            if (message.timestamp != null && message.timestamp > 0 && this.expiredIn > 0 && common_model_1.Utils.diffMsTime(message.timestamp) > this.expiredIn) {
                common_model_1.logger.warn("ignore this request since it's expired %s", msgStr);
                return;
            }
        }
        catch (e) {
            common_model_1.logger.error("fail to handle message time", e);
        }
        const msg = JSON.parse(msgStr);
        const data = this.requestedMessages.get(msg.messageId);
        if (data != null) {
            this.respondData(data, msg);
            this.requestedMessages.delete(msg.messageId);
        }
        else {
            common_model_1.logger.warn(`cannot find where to response (probably timeout happen) "${msgStr}"`);
        }
    }
}
exports.KafkaRequester = KafkaRequester;
let instance = null;
function create(clusterId, clientId, kafkaOptions, consumerOptions, producerOptions, initResponseListener = true, topicConf = {}, handleSendError, readyCallback) {
    instance = new KafkaRequester(clusterId, clientId, kafkaOptions, consumerOptions, producerOptions, initResponseListener, topicConf, handleSendError, readyCallback);
}
function getInstance() {
    if (instance == null) {
        throw new Error("please call create first");
    }
    return instance;
}
function getResponse(msg) {
    if (msg.data != null) {
        const response = msg.data;
        if (response.status != null) {
            throw common_model_1.Errors.createFromStatus(response.status);
        }
        else {
            return response.data;
        }
    }
    else {
        common_model_1.logger.error("no data in response of message", msg);
        throw new common_model_1.Errors.GeneralError();
    }
}
