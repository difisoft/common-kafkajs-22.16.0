import { KafkaConfig, ConsumerConfig } from 'kafkajs';
interface IKafkaMessage {
    value: Buffer;
    size: number;
    topic: string;
    offset: string;
    partition: number;
    key: string;
    timestamp: number;
}
declare class StreamHandler {
    private consumer;
    private isRunning;
    constructor(kafkaOptions: KafkaConfig, consumerOptions: ConsumerConfig, topics: string[], dataHandler: (data: IKafkaMessage, handler: StreamHandler) => void, readyCallback?: () => void);
    private start;
    close(): Promise<void>;
}
declare function createBroadcastListener(clientId: string, kafkaOptions: KafkaConfig, consumerOptions: ConsumerConfig, topics: string[], dataHandler: (data: IKafkaMessage, handler: StreamHandler) => void): StreamHandler;
export { StreamHandler, IKafkaMessage, createBroadcastListener };
