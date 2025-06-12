import { IConf, IMessage } from "@/types";
import { Handle, MessageHandler } from "@/MessageHandler";
import { IKafkaMessage, StreamHandler } from "@/StreamHandler";
import { logger } from "common-model";

export interface IConsumerProcess {
  process(msg: IMessage): void;
}

export interface IRawProcessor {
  process: Handle;
}

export class ConsumerHub {
  private rawHandle: MessageHandler;
  private handle: (message: IKafkaMessage) => void;
  private stream: StreamHandler;

  constructor(
    private conf: IConf,
    private options: any,
    private rawMapping: { [key: string]: IRawProcessor },
    private mapping: { [key: string]: IConsumerProcess },
    private topicConf: any = {},
    private readyCallback?: () => void
  ) {
    this.rawMapping = rawMapping;
    this.mapping = mapping;

    this.rawHandle = new MessageHandler();

    this.handle = (message: IKafkaMessage) => {
      try {
        if (message.value == null) {
          return;
        }
        const rawProcessor = this.rawMapping[message.topic];
        if (rawProcessor != null) {
          this.rawHandle.handle(message, rawProcessor.process);
        } else {
          const processor = mapping[message.topic];
          if (processor != null) {
            const msgString: string = message.value.toString();
            const msg: IMessage = JSON.parse(msgString);
            try {
              processor.process(msg);
            } catch (e) {
              logger.error("error in process msg", msgString, e);
            }
          }
        }
      } catch (e) {
        logger.error("error in handle msg", message, e);
      }
    };
    this.stream = this.createStream();
  }

  public createStream() {
    const topics = [];
    if (this.rawMapping != null) {
      topics.push(...Object.keys(this.rawMapping));
    }
    if (this.mapping != null) {
      topics.push(...Object.keys(this.mapping));
    }

    return new StreamHandler(
      this.conf,
      this.options,
      topics,
      this.handle,
      this.topicConf,
      this.readyCallback
    );
  }

  public addProcess(topic: string, process: IConsumerProcess) {
    if (this.mapping[topic] == null) {
      this.mapping[topic] = process;
      this.stream.close();
      this.stream = this.createStream();
    }
  }

  public addRawProcess(topic: string, process: IRawProcessor) {
    if (this.rawMapping[topic] == null) {
      this.rawMapping[topic] = process;
      this.stream.close();
      this.stream = this.createStream();
    }
  }
}
