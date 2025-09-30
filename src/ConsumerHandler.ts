import { Kafka, Consumer, EachMessagePayload, KafkaConfig, ConsumerConfig } from 'kafkajs';
import { logger } from 'common-model';

interface IKafkaMessage {
  value: Buffer;
  size: number;
  topic: string;
  offset: string;
  partition: number;
  key: string;
  timestamp: number;
}

class ConsumerHandler {
  private consumer: Consumer;
  private isRunning: boolean = false;

  constructor(
    kafkaOptions: KafkaConfig,
    consumerOptions: ConsumerConfig,
    topics: string[],
    dataHandler: (data: IKafkaMessage, handler: ConsumerHandler) => void,
    readyCallback?: () => void
  ) {
    const kafka = new Kafka(kafkaOptions);

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
      logger.error('Failed to start consumer', err);
    });
  }

  private async start(
    topics: string[],
    dataHandler: (data: IKafkaMessage, handler: ConsumerHandler) => void,
    readyCallback?: () => void
  ) {
    try {
      await this.consumer.connect();
      await this.consumer.subscribe({ topics, fromBeginning: true });

      this.isRunning = true;
      logger.info('Kafka consumer is ready', { topics });
      readyCallback?.();

      await this.consumer.run({
        eachMessage: async (payload: EachMessagePayload) => {
          if (!payload.message.value) return;

          const message: IKafkaMessage = {
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
          } catch (error) {
            logger.error('Error processing message', error);
          }
        }
      });
    } catch (error) {
      logger.error('Failed to start consumer', error);
      throw error;
    }
  }

  public async close() {
    if (this.isRunning) {
      this.isRunning = false;
      await this.consumer.disconnect();
    }
  }
}

function createBroadcastListener(
  clientId: string,
  kafkaOptions: KafkaConfig,
  consumerOptions: ConsumerConfig,
  topics: string[],
  dataHandler: (data: IKafkaMessage, handler: ConsumerHandler) => void,
) {
  return new ConsumerHandler(kafkaOptions, {
    ...consumerOptions,
    groupId: clientId,
  }, topics, dataHandler);
}

export {
  ConsumerHandler,
  IKafkaMessage,
  createBroadcastListener
};