//! --------------------------------------------------------------------------------------------------------------------
//! atdis-request | https://github.com/eth-p/node-atdis | MIT License | Copyright (C) 2020 eth-p
//! --------------------------------------------------------------------------------------------------------------------
import type {Task} from "atdis";
// ---------------------------------------------------------------------------------------------------------------------

/**
 * An abstract request.
 * Classes should extend this to implement new request protocols such as HTTP. 
 */
export abstract class Request<T> {

	/**
	 * Whether or not the request can be cached.
	 * If the request can be cached, a {@link RequestPool request pool} may return an existing request object. 
	 */
	public cacheable: boolean;

	/**
	 * The number of times that a request can be transparently retried before it will fail.
	 */
	public retries: number;

	/**
	 * Creates a new request. 
	 * @param options The request options.
	 */
	public constructor(options?: RequestOptions) {
		this.cacheable = options?.cacheable ?? true;
		this.retries = options?.retries ?? 0;
	}

	/**
	 * A cache key that uniquely represents this request.
	 * Requests with identical cache keys will be reused.
	 */
	public abstract get key(): string;

	/**
	 * Performs the request.
	 * This is used internally by the `atdis` {@link Task} class.
	 * 
	 * @throws ThrottleError When the request pool should be throttled.
	 */
	public abstract async run(): Promise<T>;
	
}

export interface RequestOptions {

	/**
	 * Whether or not the request can be cached.
	 * If the request can be cached, a {@link RequestPool request pool} may return an existing request object.
	 */
	cacheable?: boolean;

	/**
	 * The number of times that a request can be transparently retried before it will fail.
	 */
	retries?: number;
	
}
