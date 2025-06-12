"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamHandler = void 0;
exports.createBroadcastListener = createBroadcastListener;
const kafkajs_1 = require("kafkajs");
const common_model_1 = require("common-model");
class StreamHandler {
    consumer;
    isRunning = false;
    constructor(conf, options, topics, dataHandler, topicConf = {}, readyCallback) {
        const kafka = new kafkajs_1.Kafka({
            clientId: conf.clientId,
            brokers: conf.kafkaUrls,
            ...conf.consumerConfig
        });
        this.consumer = kafka.consumer({
            groupId: conf.clusterId,
            ...options
        });
        this.start(topics, dataHandler, readyCallback).catch(err => {
            common_model_1.logger.error('Failed to start consumer', err);
        });
    }
    async start(topics, dataHandler, readyCallback) {
        try {
            await this.consumer.connect();
            await this.consumer.subscribe({ topics, fromBeginning: true });
            this.isRunning = true;
            common_model_1.logger.info('Kafka consumer is ready', { topics });
            readyCallback?.();
            await this.consumer.run({
                eachMessage: async (payload) => {
                    if (!payload.message.value)
                        return;
                    const message = {
                        value: payload.message.value,
                        size: payload.message.value.length,
                        topic: payload.topic,
                        offset: payload.message.offset,
                        partition: payload.partition,
                        key: payload.message.key?.toString() || '',
                        timestamp: payload.message.timestamp ? Number(payload.message.timestamp) : 0
                    };
                    try {
                        dataHandler(message, this);
                    }
                    catch (error) {
                        common_model_1.logger.error('Error processing message', error);
                    }
                }
            });
        }
        catch (error) {
            common_model_1.logger.error('Failed to start consumer', error);
            throw error;
        }
    }
    async close() {
        if (this.isRunning) {
            this.isRunning = false;
            await this.consumer.disconnect();
        }
    }
}
exports.StreamHandler = StreamHandler;
function createBroadcastListener(conf, options, topics, dataHandler, topicConf = {}) {
    const opt = {
        ...{
            groupId: conf.clientId,
        },
        ...options
    };
    return new StreamHandler(conf, opt, topics, dataHandler, topicConf);
}
