import { HandleResult } from './MessageHandler';
import { IKafkaMessage } from './StreamHandler';
import { IConf, IMessage } from './types';
export interface IContext<T> {
    id: string;
    txId: string;
    orgMsg: IMessage<T>;
    requestId?: string;
}
export type ApiHandler<T> = (request: T, ctx: IContext<T>) => HandleResult;
export interface ApiEndpoint<T> {
    uri: string;
    handler: ApiHandler<T>;
}
export declare abstract class AbstractEndpointHandler {
    private readonly listenTopic;
    private readonly kafkaConfig;
    private readonly kafkaConsumerOptions?;
    private readonly kafkaTopicOptions?;
    private uriList;
    constructor(listenTopic: string, kafkaConfig: IConf, kafkaConsumerOptions?: any | undefined, kafkaTopicOptions?: any | undefined);
    init(): void;
    abstract matchingList(): ApiEndpoint<any>[];
    handle(message: IMessage<any>, orgMessage?: IKafkaMessage): HandleResult;
}
