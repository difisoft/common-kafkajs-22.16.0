import { HandleResult } from './MessageHandler';
import { IKafkaMessage } from './ConsumerHandler';
import { IMessage } from './types';
import { ConsumerConfig, KafkaConfig, ProducerConfig } from 'kafkajs';
export interface IContext<T> {
    id: string;
    txId: string;
    orgMsg: IMessage<T>;
    requestId?: string;
}
export declare function convertContextType<T, R>(ctx: IContext<T>, data: R): IContext<R>;
export type ApiHandler<T> = (request: T, ctx: IContext<T>) => HandleResult;
export interface ApiEndpoint<T> {
    uri: string;
    handler: ApiHandler<T>;
}
export declare abstract class AbstractKafkaController {
    private readonly clusterId;
    private readonly kafkaOptions;
    private readonly consumerOptions;
    private readonly producerOptions;
    private uriList;
    constructor(clusterId: string, kafkaOptions: KafkaConfig, consumerOptions: Omit<ConsumerConfig, "groupId">, producerOptions: ProducerConfig);
    init(): void;
    abstract matchingList(): ApiEndpoint<any>[];
    handle(message: IMessage<any>, orgMessage?: IKafkaMessage): HandleResult;
}
