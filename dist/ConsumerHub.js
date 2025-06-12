"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsumerHub = void 0;
const MessageHandler_1 = require("./MessageHandler");
const StreamHandler_1 = require("./StreamHandler");
const common_model_1 = require("common-model");
class ConsumerHub {
    conf;
    options;
    rawMapping;
    mapping;
    topicConf;
    readyCallback;
    rawHandle;
    handle;
    stream;
    constructor(conf, options, rawMapping, mapping, topicConf = {}, readyCallback) {
        this.conf = conf;
        this.options = options;
        this.rawMapping = rawMapping;
        this.mapping = mapping;
        this.topicConf = topicConf;
        this.readyCallback = readyCallback;
        this.rawMapping = rawMapping;
        this.mapping = mapping;
        this.rawHandle = new MessageHandler_1.MessageHandler();
        this.handle = (message) => {
            try {
                if (message.value == null) {
                    return;
                }
                const rawProcessor = this.rawMapping[message.topic];
                if (rawProcessor != null) {
                    this.rawHandle.handle(message, rawProcessor.process);
                }
                else {
                    const processor = mapping[message.topic];
                    if (processor != null) {
                        const msgString = message.value.toString();
                        const msg = JSON.parse(msgString);
                        try {
                            processor.process(msg);
                        }
                        catch (e) {
                            common_model_1.logger.error("error in process msg", msgString, e);
                        }
                    }
                }
            }
            catch (e) {
                common_model_1.logger.error("error in handle msg", message, e);
            }
        };
        this.stream = this.createStream();
    }
    createStream() {
        const topics = [];
        if (this.rawMapping != null) {
            topics.push(...Object.keys(this.rawMapping));
        }
        if (this.mapping != null) {
            topics.push(...Object.keys(this.mapping));
        }
        return new StreamHandler_1.StreamHandler(this.conf, this.options, topics, this.handle, this.topicConf, this.readyCallback);
    }
    addProcess(topic, process) {
        if (this.mapping[topic] == null) {
            this.mapping[topic] = process;
            this.stream.close();
            this.stream = this.createStream();
        }
    }
    addRawProcess(topic, process) {
        if (this.rawMapping[topic] == null) {
            this.rawMapping[topic] = process;
            this.stream.close();
            this.stream = this.createStream();
        }
    }
}
exports.ConsumerHub = ConsumerHub;
