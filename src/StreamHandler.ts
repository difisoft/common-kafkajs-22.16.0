import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { logger } from 'common-model';
import { IConf } from "./types";

interface IKafkaMessage {
  value: Buffer;
  size: number;
  topic: string;
  offset: string;
  partition: number;
  key: string;
  timestamp: number;
}

class StreamHandler {
  private consumer: Consumer;
  private isRunning: boolean = false;

  constructor(
    conf: IConf,
    options: any,
    topics: string[],
    dataHandler: (data: IKafkaMessage, handler: StreamHandler) => void,
    topicConf: any = {},
    readyCallback?: () => void
  ) {
    const kafka = new Kafka({
      clientId: conf.clientId,
      brokers: conf.kafkaUrls,
      ...conf.consumerConfig
    });

    this.consumer = kafka.consumer({
      groupId: conf.clusterId,
      ...options
    });

    this.start(topics, dataHandler, readyCallback).catch(err => {
      logger.error('Failed to start consumer', err);
    });
  }

  private async start(
    topics: string[],
    dataHandler: (data: IKafkaMessage, handler: StreamHandler) => void,
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
  conf: IConf,
  options: any,
  topics: string[],
  dataHandler: (data: IKafkaMessage, handler: StreamHandler) => void,
  topicConf: any = {}
) {
  const opt = {
    ...{
      groupId: conf.clientId,
    },
    ...options
  };
  return new StreamHandler(conf, opt, topics, dataHandler, topicConf);
}

export {
  StreamHandler,
  IKafkaMessage,
  createBroadcastListener
};