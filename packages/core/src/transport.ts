/**
 * Transport abstractions for wallet communication
 */

/**
 * Transport message
 */
export interface TransportMessage<T = unknown> {
  /** Message ID */
  id: string;
  /** Message type */
  type: string;
  /** Message payload */
  payload: T;
  /** Timestamp */
  timestamp: number;
  /** Origin */
  origin?: string;
}

/**
 * Transport response
 */
export interface TransportResponse<T = unknown> {
  /** Response ID (matches request ID) */
  id: string;
  /** Success flag */
  success: boolean;
  /** Response data (if success) */
  data?: T;
  /** Error (if not success) */
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Transport interface for wallet communication
 * Different wallets may use different transports (postMessage, WebSocket, HTTP, etc.)
 */
export interface Transport {
  /**
   * Send a message and wait for response
   */
  send<TRequest = unknown, TResponse = unknown>(
    message: TransportMessage<TRequest>
  ): Promise<TransportResponse<TResponse>>;

  /**
   * Subscribe to incoming messages
   */
  onMessage(handler: (message: TransportMessage) => void): () => void;

  /**
   * Check if transport is connected
   */
  isConnected(): boolean;

  /**
   * Connect the transport
   */
  connect(): Promise<void>;

  /**
   * Disconnect the transport
   */
  disconnect(): Promise<void>;
}

/**
 * PostMessage transport (for browser-based wallets)
 */
export class PostMessageTransport implements Transport {
  private messageHandlers: Set<(message: TransportMessage) => void> =
    new Set();
  private connected = false;
  private targetOrigin: string;
  private targetWindow: Window | null = null;

  constructor(targetOrigin: string) {
    this.targetOrigin = targetOrigin;
  }

  setTargetWindow(window: Window | null): void {
    this.targetWindow = window;
  }

  async connect(): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('PostMessageTransport requires browser environment');
    }

    window.addEventListener('message', this.handleMessage.bind(this));
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    window.removeEventListener('message', this.handleMessage.bind(this));
    this.connected = false;
    this.messageHandlers.clear();
  }

  isConnected(): boolean {
    return this.connected;
  }

  async send<TRequest, TResponse>(
    message: TransportMessage<TRequest>
  ): Promise<TransportResponse<TResponse>> {
    if (!this.connected) {
      throw new Error('Transport not connected');
    }

    if (!this.targetWindow) {
      throw new Error('Target window not set');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Transport timeout for message ${message.id}`));
      }, 30000); // 30 second timeout

      const handler = (event: MessageEvent) => {
        if (
          event.origin !== this.targetOrigin ||
          event.data?.id !== message.id
        ) {
          return;
        }

        clearTimeout(timeout);
        window.removeEventListener('message', handler);
        resolve(event.data as TransportResponse<TResponse>);
      };

      window.addEventListener('message', handler);

      if (this.targetWindow) {
        this.targetWindow.postMessage(message, this.targetOrigin);
      }
    });
  }

  onMessage(handler: (message: TransportMessage) => void): () => void {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  private handleMessage(event: MessageEvent): void {
    if (event.origin !== this.targetOrigin) {
      return;
    }

    const message = event.data as TransportMessage;
    if (!message || !message.type) {
      return;
    }

    for (const handler of this.messageHandlers) {
      handler(message);
    }
  }
}
