import { IMessage } from "./types";
import { Handle } from "./MessageHandler";
import { ConsumerHandler } from "./ConsumerHandler";
import { ConsumerConfig, KafkaConfig } from "kafkajs";
export interface IConsumerProcess {
    process(msg: IMessage<any>): void;
}
export interface IRawProcessor {
    process: Handle;
}
export declare class ConsumerHub {
    private kafkaOptions;
    private consumerOptions;
    private rawMapping;
    private mapping;
    private readyCallback?;
    private rawHandle;
    private handle;
    private stream;
    constructor(kafkaOptions: KafkaConfig, consumerOptions: ConsumerConfig, rawMapping: {
        [key: string]: IRawProcessor;
    }, mapping: {
        [key: string]: IConsumerProcess;
    }, readyCallback?: (() => void) | undefined);
    createStream(): ConsumerHandler;
    addProcess(topic: string, process: IConsumerProcess): void;
    addRawProcess(topic: string, process: IRawProcessor): void;
}
