"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsumerHandler = void 0;
exports.createBroadcastListener = createBroadcastListener;
const kafkajs_1 = require("kafkajs");
const common_model_1 = require("common-model");
class ConsumerHandler {
    consumer;
    isRunning = false;
    constructor(kafkaOptions, consumerOptions, topics, dataHandler, readyCallback) {
        const kafka = new kafkajs_1.Kafka(kafkaOptions);
        this.consumer = kafka.consumer({
            ...consumerOptions,
            sessionTimeout: 30000,
            heartbeatInterval: 3000,
            maxBytesPerPartition: 1048576, // 1MB
            retry: {
                initialRetryTime: 100,
                retries: 8
            },
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
exports.ConsumerHandler = ConsumerHandler;
function createBroadcastListener(clientId, kafkaOptions, consumerOptions, topics, dataHandler) {
    return new ConsumerHandler(kafkaOptions, {
        ...consumerOptions,
        groupId: clientId,
    }, topics, dataHandler);
}
