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
    /**
     * if not specify, we will use default scope group
     * if specify as empty, mean not publish this scope to ADMIN only.
     */
    scopeGroups?: string[];
    /**
     * auto generated from uri
     */
    operationId?: string;
}
export declare function generateOperatorId(serviceName: string, uri: string): string;
export declare abstract class AbstractKafkaController {
    private readonly serviceName;
    private readonly clusterId;
    private readonly kafkaOptions;
    private readonly consumerOptions;
    private readonly producerOptions;
    private uriList;
    constructor(serviceName: string, clusterId: string, kafkaOptions: KafkaConfig, consumerOptions: Omit<ConsumerConfig, "groupId">, producerOptions: ProducerConfig);
    init(): void;
    protected abstract matchingList(): ApiEndpoint<any>[];
    protected abstract getOpenApiFilePath(): string;
    handle(message: IMessage<any>, orgMessage?: IKafkaMessage): HandleResult;
}
